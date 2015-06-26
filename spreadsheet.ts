/// <reference path="./typings/tsd.d.ts" />
/// <reference path="../phosphor/dist/phosphor.d.ts" />
import Orientation = phosphor.widgets.Orientation;
import SizePolicy = phosphor.widgets.SizePolicy;
import Widget = phosphor.widgets.Widget;
import SplitPanel = phosphor.widgets.SplitPanel;
import Size = phosphor.utility.Size;
import Menu = phosphor.widgets.Menu;
import MenuBar = phosphor.widgets.MenuBar;
import MenuItem = phosphor.widgets.MenuItem;
import connect = phosphor.core.connect;

/*
TODO
-Should make preventDefault only happen if focused on the spreadsheet.
-Shift select rows/cols
-Select all upon the top left corner?
-Make cells extend for longer text
-Improve undefined checks
-Sort by...
-Add/Remove rows/cols
-Undo/Redo
*/

/*known bugs
-Internet Explorer mystery focus on click
-Some stuff doesnt work on internet explorer because it is an amazing program
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
		this.updateText();

		this._div.appendTo(this.node);
		this._div.addClass('label');
		this._div.data("label", this);

		this.addClass('content');
		this.verticalSizePolicy = SizePolicy.Fixed;
		this.horizontalSizePolicy = SizePolicy.MinimumExpanding;
	}

	rowInserted() {
		if (!this.isCol) {
			this.num++;
			this.updateText();
		}
	}
	colInserted() {
		if (this.isCol) {
			this.num++;
			this.updateText();
		}
	}
	rowDeleted() {
		if (!this.isCol) {
			this.num--;
			this.updateText();
		}
	}
	colDeleted() {
		if (this.isCol) {
			this.num--;
			this.updateText();
		}
	}

	updateText() {
		var num = this.num;
		this._div.text("");
		if (!this.isCol) {
			this._div.text(num);
		}
		else {
			while (num > 0) {
				num--;
				this._div.text(String.fromCharCode(65 + (num % 26)) + this._div.text());
				num = Math.floor(num / 26);
			}
		}
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

					if (typeof cell !== 'undefined') {
						manager.mouseDown = true;
						if (!e.shiftKey) {

							manager.removeFocus();
							manager.clearSelections();

							manager.focusCell(cell);
						}
						else {
							manager.mouseSelectRange(cell);
						}
					}

					if (typeof label !== 'undefined') {
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
				if (typeof e.target !== 'undefined' && typeof manager.focusedCell != 'undefined') {
					var cell = <Cell>$(e.target).data("cell");
					if(manager.mouseDown && typeof cell !== 'undefined' && !manager.editing) {
						manager.mouseSelectRange(cell);
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
				if (typeof e.target !== 'undefined' && typeof $(e.target).data('cell') !== 'undefined') {
					manager.beginEdits();
				}
			});

			/* --------------------KEY PRESS -----------------------*/

			window.addEventListener("keydown", function (e : KeyboardEvent) {
				switch (e.keyCode) {

					case 13: //enter
						if (e.shiftKey) {
							manager.move(true, 0, -1);
						}
						else {
							manager.move(true, 0, 1);
						}
						if (manager.editing) {
							e.preventDefault();
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
						else {
							if (manager.maxX > manager.focusedCell._cellx) {
								manager.maxX--;
								manager.selectArea();
							}
							else {
								if (manager.minX > 1) {
									manager.minX--;
									manager.selectArea();
								}
							}
						}
						break;
					case 38: //up arrow
						if (!e.shiftKey) {
							manager.move(false, 0, -1);
						}
						else {
							if (manager.maxY > manager.focusedCell._celly) {
								manager.maxY--;
								manager.selectArea();
							
							}
							else {
								if (manager.minY > 1) {
									manager.minY--;
									manager.selectArea();
								}
							}
						}
						break;
					case 39: //right arrow
						if (!e.shiftKey) {
							manager.move(false, 1, 0);
						}
						else {
							if (manager.minX < manager.focusedCell._cellx) {
								manager.minX++;
								manager.selectArea();
							}
							else {
								if (manager.maxX < sheet.cells.length) {
									manager.maxX++;
									manager.selectArea();
								}
							}
						}
						break;
					case 40: //down arrow
						if (!e.shiftKey) {
							manager.move(false, 0, 1);
						}
						else {
							if (manager.minY < manager.focusedCell._celly) {
								manager.minY++;
								manager.selectArea();
							}
							else {
								if (manager.maxY < sheet.cells[0].length) {
									manager.maxY++;
									manager.selectArea();
								}
							}
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
							if (typeof manager.focusedCell !== 'undefined') {
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
							if (manager.minX + j <= sheet.cells.length && manager.minY + i <= sheet.cells[0].length) {
								if (typeof cells[j] !== 'undefined') {
									manager.setCell(manager.minX + j - 1, manager.minY + i - 1, cells[j]);
								}
								else {
									manager.setCell(manager.minX + j - 1, manager.minY + i - 1, "");
								}
								manager.select(manager.getCell(manager.minX + j - 1, manager.minY + i - 1));
							}
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
		this.createMenu();
	}

	insertRow(rowNum: number) {
		for (var i = 0; i < this.sheet.labels.length; i++) {
			if (this.sheet.labels[i].num >= rowNum) {
				this.sheet.labels[i].rowInserted();
			}
		}
		var label = new Label(false, rowNum);
		this.sheet.columns[0].insertWidget(rowNum, label);
		this.sheet.labels.push(label);

		for (var i = 1; i < this.sheet.columns.length; i++) {
			this.sheet.cellVals[i - 1].splice(rowNum - 1, 0, "");
			var cell = new Cell(this.sheet, i, rowNum);
			this.sheet.cells[i - 1].splice(rowNum - 1, 0, cell);
			this.sheet.columns[i].insertWidget(rowNum, cell);
			for (var j = rowNum; j < this.sheet.cells[i - 1].length; j++) {
				this.sheet.cells[i - 1][j]._celly++;
			}
			console.log(this.sheet.cellVals[i - 1].length);
		}
		this.removeFocus();
		this.clearSelections();
		this.selectRow(rowNum - 1);
	}

	insertCol(colNum: number) {
		for (var i = 0; i < this.sheet.labels.length; i++) {
			if (this.sheet.labels[i].num >= colNum) {
				this.sheet.labels[i].colInserted();
			}
		}

		var panel = new SplitPanel(Orientation.Vertical);
		this.sheet.insertWidget(colNum, panel);
		var label = new Label(true, colNum);
		panel.addWidget(label);
		this.sheet.labels.push(label);
		this.sheet.columns.splice(colNum, 0, panel);

		console.log(this.sheet.cells);
		for (var i = colNum - 1; i < this.sheet.cells.length; i++) {
			for (var j = 0; j < this.sheet.cells[0].length; j++) {
				this.sheet.cells[i][j]._cellx++;
			}
		}
		var len = this.sheet.cells[0].length;
		this.sheet.cells.splice(colNum - 1, 0, new Array());
		this.sheet.cellVals.splice(colNum - 1, 0, new Array());

		for (var i = 0; i < len; i++) {
			var cell = new Cell(this.sheet, colNum, i + 1);
			cell.width = this.focusedCell.width;
			panel.addWidget(cell);
			this.sheet.cellVals[colNum - 1].push("");
			this.sheet.cells[colNum - 1].push(cell);
		}
		this.removeFocus();
		this.clearSelections();
		this.selectCol(colNum - 1);
	}

	createMenu() {
		(function(manager : SelectionManager) {

			var handler = {
				rowBefore: function() {
					console.log("Add row before");
					manager.insertRow(manager.focusedCell._celly);
				},
				rowAfter: function() {
					console.log("Add row after"); 
					manager.insertRow(manager.focusedCell._celly + 1);
				},
				colBefore: function() {
					console.log("Add col before"); 
					manager.insertCol(manager.focusedCell._cellx);
				},
				colAfter: function() {
					console.log("Add col after"); 
					manager.insertCol(manager.focusedCell._cellx + 1);
				},
			};
			var rowBeforeItem = new MenuItem({
				text: "Insert Row Before",
				className: 'rowBefore'
			});
			var rowAfterItem = new MenuItem({
				text: "Insert Row After",
				className: 'rowAfter'
			});
			var colBeforeItem = new MenuItem({
				text: "Insert Column Before",
				className: 'colBefore'
			});
			var colAfterItem = new MenuItem({
				text: "Insert Column After",
				className: 'colAfter'
			});

			connect(rowBeforeItem, MenuItem.triggered, handler, handler.rowBefore);
			connect(rowAfterItem, MenuItem.triggered, handler, handler.rowAfter);
			connect(colBeforeItem, MenuItem.triggered, handler, handler.colBefore);
			connect(colAfterItem, MenuItem.triggered, handler, handler.colAfter);

			var rightClickMenu = new Menu([
				rowBeforeItem,
				rowAfterItem,
				colBeforeItem,
				colAfterItem]);
	        document.addEventListener('contextmenu', function (event) {
	            event.preventDefault();
	            var x = event.clientX;
	            var y = event.clientY;
	            rightClickMenu.popup(x, y);
	        });
		})(this);
	}

	removeFocus() {
		if (typeof this.focusedCell !== 'undefined') {
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

	mouseSelectRange(target : Cell) {
		if (target._cellx != this.focusedCell._cellx || 
			target._celly != this.focusedCell._celly) {
			document.getSelection().removeAllRanges();
			//this.focusedCell._div.focus();
		}
		this.minX = Math.min(target._cellx, this.focusedCell._cellx);
		this.maxX = Math.max(target._cellx, this.focusedCell._cellx);
		this.minY = Math.min(target._celly, this.focusedCell._celly);
		this.maxY = Math.max(target._celly, this.focusedCell._celly);
		this.selectArea();
	}

	selectArea() {
		this.clearSelections();
		for (var i = this.minX; i <= this.maxX; i++) {
			for (var j = this.minY; j <= this.maxY; j++) {
				this.select(this.getCell(i - 1, j - 1));
			}
		}
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
		if (typeof this.focusedCell !== 'undefined' && 
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
		if (typeof this.focusedCell !== 'undefined') {
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
	public columns: SplitPanel[];
	public cells : Cell[][];
	public labels: Label[];
	public cellVals : string[][];
	public selector : SelectionManager;

	constructor(width : number, height : number) {
		super(Orientation.Horizontal);
		this.columns = new Array();
		this.labels = new Array();

		this.handleSize = 1;
		this.cells = new Array();
		this.cellVals = new Array();
		var panel = new SplitPanel(Orientation.Vertical);
		var label = new Label(true, -1);
		panel.addWidget(label);
		this.labels.push(label);
		for (var i = 1; i <= height; i++) {
			label = new Label(false, i);
			panel.addWidget(label);
			this.labels.push(label);
		}
		this.addWidget(panel);
		this.columns.push(panel);

		for (var i = 1; i <= width; i++) {
			panel = new SplitPanel(Orientation.Vertical);
			this.cells.push(new Array());
			this.cellVals.push(new Array());
			label = new Label(true, i);
			panel.addWidget(label);
			this.labels.push(label);

			for (var j = 1; j <= height; j++) {
				this.cellVals[i - 1].push("");

				var cell = new Cell(this, i, j);
				panel.addWidget(cell);
				this.cells[i - 1].push(cell);
			}
			this.addWidget(panel);
			this.columns.push(panel);
		}

		this.selector = new SelectionManager(this);

		//addEventListener("dblclick", this.makeEditable);
		//addEventListener("mousemove", this.dragHandler);
		//addEventListener("mouseup", this.mouseUp);
		//addEventListener("keypress", this.makeEditable);
	}


}


function main() {
	setup(15, 27);
}

function setup(width : number, height : number) {
	var spreadsheet = new Spreadsheet(width, height);

	spreadsheet.attach(document.getElementById('main'));
	//spCol.horizontalSizePolicy = SizePolicy.Fixed;

  	spreadsheet.fit();

 	window.onresize = () => spreadsheet.fit();
}

window.onload = main;