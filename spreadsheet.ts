/// <reference path="./typings/tsd.d.ts" />
/// <reference path="../phosphor/dist/phosphor.d.ts" />
import Orientation = phosphor.widgets.Orientation;
import SizePolicy = phosphor.widgets.SizePolicy;
import Widget = phosphor.widgets.Widget;
import SplitPanel = phosphor.widgets.SplitPanel;
import Size = phosphor.utility.Size;

/*
TODO
-Should make preventDefault only happen if focused on the spreadsheet.
-Make cells extend for longer text
-Shift-arrow highlighting
*/

/*known bugs
-Internet Explorer mystery focus on click
*/

function is(type : string, obj : Object) {
    var clas = Object.prototype.toString.call(obj).slice(8, -1);
    return obj !== undefined && obj !== null && clas === type;
}

class Label extends Widget {
	public _div: JQuery;
	public isCol: boolean;
	public num: number;
	constructor(isCol: boolean, num: number) {
		super();
		this._div = $('<div/>').attr('contenteditable', 'false');
		this.num = num;
		this.isCol = isCol;

		if (!isCol) {
			this._div.text(num);
		}
		else {
			while (num > 0) {
				num -= 1;
				this._div.text(String.fromCharCode(65 + (num % 26)) + this._div.text());
				num = Math.floor(num / 26);
			}
		}
		this._div.appendTo(this.node);
		this._div.addClass('label');
		this._div.data("label", this);

		this.addClass('content');
		this.verticalSizePolicy = SizePolicy.Fixed;
		this.horizontalSizePolicy = SizePolicy.MinimumExpanding;
	}
}

class Cell extends Widget {
	public _cellx : number;
	public _celly : number;
	public _sheet : Spreadsheet;
	public _div : JQuery;

	constructor(parent : Spreadsheet, x : number, y : number) {
		super();
		this._cellx = x;
		this._celly = y;
		this._sheet = parent;
		this._div = $('<div/>').attr('contenteditable', 'false');
		//this.attach(this._div);
		this._div.appendTo(this.node);
		this._div.addClass('cell');
		this._div.data("cell", this);

		this.addClass('content');
		this.verticalSizePolicy = SizePolicy.Fixed;
		this.horizontalSizePolicy = SizePolicy.MinimumExpanding;

		this.updateView();


		this._div.focus(this, this.onFocus);
		this._div.blur(this, this.onBlur)


		//this.node.addEventListener("copy", function(){console.log("COPIED STUFF!")});
	}


	onFocus(e : JQueryEventObject) {
		console.log(e);
	}

	onBlur(e : JQueryEventObject) {
		console.log(e);
		var cell = <Cell>e.data;
		cell.pushBack();
	}

	focus() {
		this._div.focus();
		this._div.addClass('focused');
	}

	editable() {
		this._div.attr('contenteditable', 'true');
	}

	updateView() {
		this._div.text(this._sheet.cellVals[this._cellx - 1][this._celly - 1]);
	}
	pushBack() {
		this._sheet.cellVals[this._cellx - 1][this._celly - 1] = this._div.text();
		this._div.attr('contenteditable', 'false');
		this._sheet.selector.endEdits();
	}
	equals(other : Cell) {
		return this._cellx == other._cellx && this._celly == other._celly;
	}
}

class SelectionManager {
	private sheet: Spreadsheet;
	private selectedCells: Cell[];
	private focusedCell: Cell;
	private mouseDown: boolean; //for highlighting
	private editing: boolean; //for navigation, if false, not editing a cell
	public minX: number;
	public maxX: number;
	public minY: number;
	public maxY: number;

	constructor(sheet : Spreadsheet) {
		this.sheet = sheet;
		this.selectedCells = new Array();
		this.editing = false;

		(function(sheet : Spreadsheet, manager : SelectionManager) {

			/* ----------------- MOUSE DOWN ----------------------*/
			sheet.node.addEventListener("mousedown", function (e : MouseEvent) {
				if (is('HTMLDivElement', e.target)) {
					var cell = <Cell>$(e.target).data("cell");
					var label = <Label>$(e.target).data("label");

					if (cell != undefined) {
						manager.mouseDown = true;

						manager.removeFocus();
						manager.clearSelections();

						manager.focusCell(cell);
						//manager.move(false, 0, 0);
					}

					if (label != undefined) {
						manager.removeFocus();
						manager.clearSelections();
						if (label.isCol) {
							manager.selectCol(label.num - 1);
						}
						else {
							manager.selectRow(label.num - 1);
						}
					}
				}
			});

			/* ----------------- MOUSE MOVE ----------------------*/
			sheet.node.addEventListener("mousemove", function (e : MouseEvent){
				if (e.target != undefined && manager.focusedCell != undefined) {
					var cell = <Cell>$(e.target).data("cell");
					if(manager.mouseDown && cell != undefined && !manager.editing) {
						if (cell._cellx != manager.focusedCell._cellx || 
							cell._celly != manager.focusedCell._celly) {
							document.getSelection().removeAllRanges();
							//manager.focusedCell._div.focus();
						}
						manager.minX = Math.min(cell._cellx, manager.focusedCell._cellx);
						manager.maxX = Math.max(cell._cellx, manager.focusedCell._cellx);
						manager.minY = Math.min(cell._celly, manager.focusedCell._celly);
						manager.maxY = Math.max(cell._celly, manager.focusedCell._celly);
						manager.clearSelections();
						for (var i = manager.minX; i <= manager.maxX; i++) {
							for (var j = manager.minY; j <= manager.maxY; j++) {
								manager.select(manager.getCell(i - 1, j - 1));
							}
						}
					}
				}
			});

			/* --------------- MOUSE UP --------------------------*/
			//sheet.node.addEventListener("mouseup", function (e : MouseEvent) {
			$(window).mouseup(function (e : JQueryEventObject) {
				manager.mouseDown = false;
			});

			/* -------------- DOUBLE CLICK ---------------------*/
			sheet.node.addEventListener("dblclick", function (e : MouseEvent) {
				if (e.target != undefined && $(e.target).data('cell') != undefined) {
					manager.beginEdits();
				}
			});

			/* --------------------KEY PRESS -----------------------*/

			window.addEventListener("keydown", function (e : KeyboardEvent) {

				switch (e.keyCode) {
					case 13: //enter
						if (manager.editing) {
							e.preventDefault();
						}
						else {
							if (e.shiftKey) {
								manager.move(false, 0, -1);
							}
							else {
								manager.move(false, 0, 1);
							}
						}
						break;
					case 8: //backspace/delete
					case 46:
						console.log("backspace pressed");
						if (!manager.editing) {
							e.preventDefault();
							for (var i = 0; i < manager.selectedCells.length; i++) {
								
								manager.clearCell(manager.selectedCells[i]);
							}
						}
						break;
					case 37: //left arrow
						if (!e.shiftKey) {
							manager.move(false, -1, 0);
						}
						break;
					case 38: //up arrow
						if (!e.shiftKey) {
							manager.move(false, 0, -1);
						}
						break;
					case 39: //right arrow
						if (!e.shiftKey) {
							manager.move(false, 1, 0);
						}
						break;
					case 40: //down arrow
						if (!e.shiftKey) {
							manager.move(false, 0, 1);
						}
						break;
					case 9:
						e.preventDefault(); //check focus on this one...
						if (e.shiftKey) {
							manager.move(true, -1, 0);
						}
						else {
							manager.move(true, 1, 0);
						}
						break;
					default:
						if (!manager.editing && e.keyCode >= 32 && e.keyCode != 127 && !e.altKey && !e.ctrlKey) {
							console.log(e.keyCode);
							if (manager.focusedCell != undefined) {
								manager.clearCell(manager.focusedCell);
								manager.beginEdits();
							}
						}
				}
			});
			/* --test--*/
			window.addEventListener("copy", function(e : ClipboardEvent){
				var str = "";
				for (var i = manager.minY; i <= manager.maxY; i++) {
					for (var j = manager.minX; j <= manager.maxX; j++) {
						str = str + manager.getCell(j - 1, i - 1)._div.text();
						if (j < manager.maxX) {
							str = str + '\t';
						}
					}
					if (i < manager.maxY) {
						str = str + '\r\n';
					}
				}
				e.clipboardData.setData('text/plain', str);
				e.preventDefault();
			});

			window.addEventListener("paste", function(e: ClipboardEvent) {
				console.log(e);
				if (!manager.editing) {
					manager.clearSelections();
					var lines = e.clipboardData.getData("text/plain").split("\r\n");
					var maxW = 0;
					for (var i = 0; i < lines.length; i++) {
						var cells = lines[i].split("\t");
						if (cells.length > maxW) {
							maxW = cells.length;
						}
					}
					for (var i = 0; i < lines.length; i++) {
						var cells = lines[i].split("\t");
						for (var j = 0; j < maxW; j++) {
							if (cells[j] != undefined) {
								manager.setCell(manager.minX + j - 1, manager.minY + i - 1, cells[j]);
							}
							else {
								manager.setCell(manager.minX + j - 1, manager.minY + i - 1, "");
							}
							manager.select(manager.getCell(manager.minX + j - 1, manager.minY + i - 1));
						}
					}
					manager.maxX = manager.minX + maxW - 1;
					manager.maxY = manager.minY + lines.length - 1;
					manager.removeFocus();
					manager.focusCell(manager.getCell(manager.minX - 1, manager.minY - 1));
				}
			});
		})(this.sheet, this);

		this.focusCell(this.getCell(0, 0));
	}

	removeFocus() {
		if (this.focusedCell != undefined) {
			console.log(this.focusedCell);
			this.focusedCell._div.removeClass('focused');
		}
	}

	focusCell(cell : Cell) {
		this.minX = cell._cellx;
		this.maxX = cell._cellx;
		this.minY = cell._celly;
		this.maxY = cell._celly;

		cell.focus();
		this.focusedCell = cell;
		this.select(cell);
	}

	selectRow(rowNum: number) {
		for (var i = 0; i < this.sheet.cells.length; i++) {
			this.select(this.sheet.cells[i][rowNum]);
		}
		this.sheet.cells[0][rowNum].focus();
		this.focusedCell = this.sheet.cells[0][rowNum];
		this.minX = 1;
		this.maxX = this.sheet.cells.length;
		this.minY = rowNum;
		this.maxY = rowNum;
	}

	selectCol(colNum: number) {
		if (colNum >= 0) {
			for (var i = 0; i < this.sheet.cells[0].length; i++) {
				this.select(this.sheet.cells[colNum][i]);
			}
			this.sheet.cells[colNum][0].focus();
			this.focusedCell = this.sheet.cells[colNum][0];
			this.minY = 1;
			this.maxY = this.sheet.cells[0].length;
			this.minX = colNum;
			this.maxX = colNum;
		}
	}


	clearCell (cell : Cell) {
		cell._sheet.cellVals[cell._cellx - 1][cell._celly - 1] = "";
		cell.updateView();
	}

	move(skipCheck : boolean, xAmount : number, yAmount : number) {
		if (this.focusedCell != undefined && 
			this.focusedCell._cellx + xAmount > 0 && this.focusedCell._cellx + xAmount <= this.sheet.cells.length && 
			this.focusedCell._celly + yAmount > 0 && this.focusedCell._celly + yAmount <= this.sheet.cells[0].length) {
			if (!this.editing || skipCheck) {
				this.clearSelections();
				this.focusedCell.pushBack();
				this.focusedCell._div.removeClass('focused');

				var cell = this.getCell(this.focusedCell._cellx - 1 + xAmount, this.focusedCell._celly - 1 + yAmount);
				this.focusCell(cell);
			}
		}
	}


	getCell(x : number, y : number) {
		return this.sheet.cells[x][y];
	}
	setCell(x : number, y : number, newVal : string) {
		this.sheet.cellVals[x][y] = newVal;
		this.getCell(x, y).updateView();
	}

	select(cell : Cell) {
		this.selectedCells.push(cell);
		cell._div.addClass('selected');
	}

	clearSelections() {
		for (var i = 0; i < this.selectedCells.length; i++) {
			this.selectedCells[i]._div.removeClass('selected');
		}
		this.selectedCells = new Array();
	}

	beginEdits() {
		if (this.focusedCell != undefined) {
			this.focusedCell.editable();
			this.focusedCell._div.focus();
			this.editing = true;
		}
	}
	endEdits() {
		this.editing = false;
	}

}

//act like model class
class Spreadsheet extends SplitPanel {
	public cells : Cell[][];
	public cellVals : string[][];
	public selector : SelectionManager;

	constructor(width : number, height : number) {
		super(Orientation.Horizontal);

		this.handleSize = 1;
		this.cells = new Array();
		this.cellVals = new Array();
		var colPanel = new SplitPanel(Orientation.Vertical);
		colPanel.addWidget(new Label(true, -1));
		for (var i = 1; i <= height; i++) {
			colPanel.addWidget(new Label(false, i));
		}
		this.addWidget(colPanel);

		for (var i = 1; i <= width; i++) {
			var panel = new SplitPanel(Orientation.Vertical);
			this.cells.push(new Array());
			this.cellVals.push(new Array());
			panel.addWidget(new Label(true, i));

			for (var j = 1; j <= height; j++) {
				this.cellVals[i - 1].push("" + i + " " + j);

				var cell = new Cell(this, i, j);
				panel.addWidget(cell);
				this.cells[i - 1].push(cell);
			}
			this.addWidget(panel);
		}

		this.selector = new SelectionManager(this);
		//addEventListener("dblclick", this.makeEditable);
		//addEventListener("mousemove", this.dragHandler);
		//addEventListener("mouseup", this.mouseUp);
		//addEventListener("keypress", this.makeEditable);
	}


}


function main() {
	setup(15, 53);
}

function setup(width : number, height : number) {
	var spreadsheet = new Spreadsheet(width, height);

	spreadsheet.attach(document.getElementById('main'));
	//spCol.horizontalSizePolicy = SizePolicy.Fixed;

  	spreadsheet.fit();

 	window.onresize = () => spreadsheet.fit();
}

window.onload = main;