/// <reference path="./typings/tsd.d.ts" />
/// <reference path="../phosphor/dist/phosphor.d.ts" />
import Orientation = phosphor.widgets.Orientation;
import SizePolicy = phosphor.widgets.SizePolicy;
import Widget = phosphor.widgets.Widget;
import SplitPanel = phosphor.widgets.SplitPanel;
import Size = phosphor.utility.Size;


class Cell extends Widget {
	private _input : JQuery;
	private _cellx : number;
	private _celly : number;
	private _selected : boolean;
	private _spreadsheet : Spreadsheet;

	constructor(parent : Spreadsheet, x : number, y : number) {
		super();
		this._cellx = x;
		this._celly = y;
		this._spreadsheet = parent;

		this._input = $('<div/>')
	    .attr('contenteditable', 'true');
		this._input.text(this._cellx + " " + this._celly);
		
		this._input.appendTo(this.node);
		this.addClass('content');
		this._input.addClass('cell');
		this._input.addClass('noselect');

		this._input.data("x", this._cellx);
		this._input.data("y", this._celly);


		this.verticalSizePolicy = SizePolicy.Fixed;
		this.horizontalSizePolicy = SizePolicy.MinimumExpanding;

		this._selected = false;

		$(this.node).data("cell", this);
	}

	getInput() {
		return this._input;
	}

	getSpreadsheet() {
		return this._spreadsheet;
	}

	getx() {
		return this._cellx;
	}

	gety() {
		return this._celly;
	}
}

class Spreadsheet extends SplitPanel {
	private cells : Cell[][];
	private selected : Cell[];
	private focusedCell : Cell;
	private mouseDown : boolean;

	constructor(width : number, height : number) {
		super(Orientation.Horizontal);

		this.handleSize = 1;

		this.cells = new Array();

		for (var i = 1; i <= width; i++) {
			var panel = new SplitPanel(Orientation.Vertical);
			this.cells.push(new Array());

			for (var j = 1; j <= height; j++) {
				var cell = new Cell(this, i, j);
				panel.addWidget(cell);
				this.cells[i - 1].push(cell);
			}
			this.addWidget(panel);
		}

		this.focusedCell = null;
		this.mouseDown = false;
		this.selected = new Array();

		//this seems like bad practice...
		$('body').data("spreadsheet", this);

		addEventListener("mousedown", this.focusHandler);
		addEventListener("mousemove", this.dragHandler);
		addEventListener("mouseup", this.mouseUp);
	}
	clearSelections() {
		for (var i = 0; i < this.selected.length; i++) {
			this.selected[i].getInput().removeClass('selected');
		}
		this.selected = new Array();
		// if (this.focusedCell != null) {
		// 	this.focusedCell.getInput().removeClass('selected');
		// }
	}

	focusCell(cell : Cell) {
		$('body').data("focusCell", cell);
		this.focusedCell = cell;
		this.selectCell(cell);
	}
	selectCell(cell : Cell) {
		this.selected.push(cell);
		cell.getInput().addClass('selected');
	}
	getFocusedCell() : Cell {
		return this.focusedCell;
	}
	getCell(x : number, y : number) : Cell {
		return this.cells[x][y];
	}

	focusHandler(e : MouseEvent) {
		var currentCell = <Cell>$(e.target).parent().data("cell");
		if (currentCell != undefined) {
			var sheet = currentCell.getSpreadsheet();
			sheet = <Spreadsheet>$('body').data("spreadsheet");
		}
		sheet.mouseDown = true;
		sheet.clearSelections();
		sheet.focusCell(currentCell);
	}

	dragHandler(e : MouseEvent) {
		var currentCell = <Cell>$(e.target).parent().data("cell");

		if (currentCell != undefined) {
			var sheet = currentCell.getSpreadsheet();
			sheet = <Spreadsheet>$('body').data("spreadsheet");
		
			if(sheet.mouseDown) {
				if (currentCell.getx() != sheet.getFocusedCell().getx() || 
					currentCell.gety() != sheet.getFocusedCell().gety()) {
					sheet.getFocusedCell().getInput().addClass('noselect');
					document.getSelection().removeAllRanges();
					sheet.getFocusedCell().getInput().focus();
				}
				var minX = Math.min(currentCell.getx(), sheet.getFocusedCell().getx());
				var maxX = Math.max(currentCell.getx(), sheet.getFocusedCell().getx());
				var minY = Math.min(currentCell.gety(), sheet.getFocusedCell().gety());
				var maxY = Math.max(currentCell.gety(), sheet.getFocusedCell().gety());
				sheet.clearSelections();
				for (var i = minX; i <= maxX; i++) {
					for (var j = minY; j <= maxY; j++) {
						sheet.selectCell(sheet.getCell(i - 1, j - 1));
					}
				}
			}
		}
	}

	mouseUp(e : MouseEvent) {
		console.log(this);

		var sheet = <Spreadsheet>$('body').data("spreadsheet");
		sheet.mouseDown = false;
		//sheet.getFocusedCell().getInput().removeClass('noselect');

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