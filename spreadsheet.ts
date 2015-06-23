/// <reference path="./typings/tsd.d.ts" />
/// <reference path="../phosphor/dist/phosphor.d.ts" />
import Orientation = phosphor.widgets.Orientation;
import SizePolicy = phosphor.widgets.SizePolicy;
import Widget = phosphor.widgets.Widget;
import SplitPanel = phosphor.widgets.SplitPanel;
import Size = phosphor.utility.Size;

/*
-Should make preventDefault only happen if focused on the spreadsheet.
-Make cells extend for longer text
-Fix copy/paste
*/
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

	constructor(sheet : Spreadsheet) {
		this.sheet = sheet;
		this.selectedCells = new Array();
		this.editing = false;

		(function(sheet : Spreadsheet, manager : SelectionManager) {

			/* ----------------- MOUSE DOWN ----------------------*/
			sheet.node.addEventListener("mousedown", function (e : MouseEvent) {

				if (e.target != undefined) {
					var cell = <Cell>$(e.target).data("cell");
					if (cell != undefined) {
						manager.mouseDown = true;
						cell.focus();
					}
				}

				if (manager.focusedCell != undefined) {
					if (cell == undefined || manager.focusedCell.equals(cell)) {
					}
					else {
						manager.focusedCell._div.removeClass('focused');
						manager.focusedCell = cell;
					}
				}
				else {
					manager.focusedCell = cell;
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
						var minX = Math.min(cell._cellx, manager.focusedCell._cellx);
						var maxX = Math.max(cell._cellx, manager.focusedCell._cellx);
						var minY = Math.min(cell._celly, manager.focusedCell._celly);
						var maxY = Math.max(cell._celly, manager.focusedCell._celly);
						manager.clearSelections();
						for (var i = minX; i <= maxX; i++) {
							for (var j = minY; j <= maxY; j++) {
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
				manager.beginEdits();
			});

			/* --------------------KEY PRESS -----------------------*/

			window.addEventListener("keydown", function (e : KeyboardEvent) {
				console.log(e);
				console.log(e.keyCode);

				switch (e.keyCode) {
					case 13: //enter
						if (manager.editing) {
							e.preventDefault();
						}
						else {
							if (e.shiftKey) {
								manager.moveUp(false);
							}
							else {
								manager.moveDown(false);
							}
						}
						break;
					case 8: //backspace/delete
					case 46:
						console.log("backspace pressed");
						if (!manager.editing) {
							for (var i = 0; i < manager.selectedCells.length; i++) {
								
								manager.clearCell(manager.selectedCells[i]);
							}
						}
						break;
					case 37: //left arrow
						manager.moveLeft(false);
						break;
					case 38: //up arrow
						manager.moveUp(false);
						break;
					case 39: //right arrow
						manager.moveRight(false);
						break;
					case 40: //down arrow
						manager.moveDown(false);
						break;
					case 9:
						e.preventDefault();
						if (e.shiftKey) {
							manager.moveLeft(true);
						}
						else {
							manager.moveRight(true);
						}
						break;
					default:
						if (!manager.editing) {
							if (manager.focusedCell != undefined) {
								manager.clearCell(manager.focusedCell);
								manager.beginEdits();
							}
						}
				}
			});
			/* --test--*/
			sheet.node.addEventListener("copy", function(e : ClipboardEvent){
				console.log("COPIED STUFF!")
			});
		})(this.sheet, this);
	}

	clearCell (cell : Cell) {
		cell._sheet.cellVals[cell._cellx - 1][cell._celly - 1] = "";
		cell.updateView();
	}

	moveLeft (skipCheck : boolean) {
		this.getCell(-1, 0);
		if ((this.focusedCell._cellx > 1 && !this.editing) || skipCheck) {
			this.clearSelections();
			if (this.focusedCell != undefined) {
				this.focusedCell.pushBack();
				this.focusedCell._div.removeClass('focused');
				var cell = this.getCell(this.focusedCell._cellx - 2, this.focusedCell._celly - 1);
				cell.focus();
				this.select(cell);
				this.focusedCell = cell;
			}
		}
	}

	moveRight (skipCheck : boolean) {
		if ((this.focusedCell._cellx < this.sheet.cells.length && !this.editing) || skipCheck) {
			this.clearSelections();
			if (this.focusedCell != undefined) {
				this.focusedCell.pushBack();
				this.focusedCell._div.removeClass('focused');
				var cell = this.getCell(this.focusedCell._cellx, this.focusedCell._celly - 1);

				cell.focus();
				this.select(cell);
				this.focusedCell = cell;
			}
		}
	}

	moveUp (skipCheck : boolean) {
		if ((this.focusedCell._celly > 1 && !this.editing) || skipCheck) {
			this.clearSelections();
			if (this.focusedCell != undefined) {
				this.focusedCell.pushBack();
				this.focusedCell._div.removeClass('focused');
				var cell = this.getCell(this.focusedCell._cellx - 1, this.focusedCell._celly - 2);

				cell.focus();
				this.select(cell);
				this.focusedCell = cell;
			}
		}
	}

	moveDown (skipCheck : boolean) {

		if ((this.focusedCell._celly < this.sheet.cells[0].length && !this.editing) || skipCheck) {
			this.clearSelections();
			if (this.focusedCell != undefined) {
				this.focusedCell.pushBack();
				this.focusedCell._div.removeClass('focused');
				var cell = this.getCell(this.focusedCell._cellx - 1, this.focusedCell._celly);

				cell.focus();
				this.select(cell);
				this.focusedCell = cell;
			}
		}
	}

	getCell(x : number, y : number) {
		return this.sheet.cells[x][y];
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

		for (var i = 1; i <= width; i++) {
			var panel = new SplitPanel(Orientation.Vertical);
			this.cells.push(new Array());
			this.cellVals.push(new Array());

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
	setup(15, 5);
}

function setup(width : number, height : number) {
	var spreadsheet = new Spreadsheet(width, height);

	spreadsheet.attach(document.getElementById('main'));
	//spCol.horizontalSizePolicy = SizePolicy.Fixed;

  	spreadsheet.fit();

 	window.onresize = () => spreadsheet.fit();
}

window.onload = main;