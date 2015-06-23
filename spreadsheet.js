var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="./typings/tsd.d.ts" />
/// <reference path="../phosphor/dist/phosphor.d.ts" />
var Orientation = phosphor.widgets.Orientation;
var SizePolicy = phosphor.widgets.SizePolicy;
var Widget = phosphor.widgets.Widget;
var SplitPanel = phosphor.widgets.SplitPanel;
var Size = phosphor.utility.Size;
/*
-Should make preventDefault only happen if focused on the spreadsheet.
-Make cells extend for longer text
-Fix copy/paste
*/
var Cell = (function (_super) {
    __extends(Cell, _super);
    function Cell(parent, x, y) {
        _super.call(this);
        this._cellx = x;
        this._celly = y;
        this._sheet = parent;
        this._div = $('<div/>').attr('contenteditable', 'false');
        //this.attach(this._div);
        this._div.appendTo(this.node);
        this._div.addClass('cell');
        this._div.data("cell", this);
        this.addClass('content');
        this.verticalSizePolicy = 0 /* Fixed */;
        this.horizontalSizePolicy = SizePolicy.MinimumExpanding;
        this.updateView();
        this._div.focus(this, this.onFocus);
        this._div.blur(this, this.onBlur);
        //this.node.addEventListener("copy", function(){console.log("COPIED STUFF!")});
    }
    Cell.prototype.onFocus = function (e) {
        console.log(e);
    };
    Cell.prototype.onBlur = function (e) {
        console.log(e);
        var cell = e.data;
        cell.pushBack();
    };
    Cell.prototype.focus = function () {
        this._div.focus();
        this._div.addClass('focused');
    };
    Cell.prototype.editable = function () {
        this._div.attr('contenteditable', 'true');
    };
    Cell.prototype.updateView = function () {
        this._div.text(this._sheet.cellVals[this._cellx - 1][this._celly - 1]);
    };
    Cell.prototype.pushBack = function () {
        this._sheet.cellVals[this._cellx - 1][this._celly - 1] = this._div.text();
        this._div.attr('contenteditable', 'false');
        this._sheet.selector.endEdits();
    };
    Cell.prototype.equals = function (other) {
        return this._cellx == other._cellx && this._celly == other._celly;
    };
    return Cell;
})(Widget);
var SelectionManager = (function () {
    function SelectionManager(sheet) {
        this.sheet = sheet;
        this.selectedCells = new Array();
        this.editing = false;
        (function (sheet, manager) {
            /* ----------------- MOUSE DOWN ----------------------*/
            sheet.node.addEventListener("mousedown", function (e) {
                if (e.target != undefined) {
                    var cell = $(e.target).data("cell");
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
            sheet.node.addEventListener("mousemove", function (e) {
                if (e.target != undefined && manager.focusedCell != undefined) {
                    var cell = $(e.target).data("cell");
                    if (manager.mouseDown && cell != undefined && !manager.editing) {
                        if (cell._cellx != manager.focusedCell._cellx || cell._celly != manager.focusedCell._celly) {
                            document.getSelection().removeAllRanges();
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
            $(window).mouseup(function (e) {
                manager.mouseDown = false;
            });
            /* -------------- DOUBLE CLICK ---------------------*/
            sheet.node.addEventListener("dblclick", function (e) {
                manager.beginEdits();
            });
            /* --------------------KEY PRESS -----------------------*/
            window.addEventListener("keydown", function (e) {
                console.log(e);
                console.log(e.keyCode);
                switch (e.keyCode) {
                    case 13:
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
                    case 8:
                    case 46:
                        console.log("backspace pressed");
                        if (!manager.editing) {
                            for (var i = 0; i < manager.selectedCells.length; i++) {
                                manager.clearCell(manager.selectedCells[i]);
                            }
                        }
                        break;
                    case 37:
                        manager.moveLeft(false);
                        break;
                    case 38:
                        manager.moveUp(false);
                        break;
                    case 39:
                        manager.moveRight(false);
                        break;
                    case 40:
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
            sheet.node.addEventListener("copy", function (e) {
                console.log("COPIED STUFF!");
            });
        })(this.sheet, this);
    }
    SelectionManager.prototype.clearCell = function (cell) {
        cell._sheet.cellVals[cell._cellx - 1][cell._celly - 1] = "";
        cell.updateView();
    };
    SelectionManager.prototype.moveLeft = function (skipCheck) {
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
    };
    SelectionManager.prototype.moveRight = function (skipCheck) {
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
    };
    SelectionManager.prototype.moveUp = function (skipCheck) {
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
    };
    SelectionManager.prototype.moveDown = function (skipCheck) {
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
    };
    SelectionManager.prototype.getCell = function (x, y) {
        return this.sheet.cells[x][y];
    };
    SelectionManager.prototype.select = function (cell) {
        this.selectedCells.push(cell);
        cell._div.addClass('selected');
    };
    SelectionManager.prototype.clearSelections = function () {
        for (var i = 0; i < this.selectedCells.length; i++) {
            this.selectedCells[i]._div.removeClass('selected');
        }
        this.selectedCells = new Array();
    };
    SelectionManager.prototype.beginEdits = function () {
        if (this.focusedCell != undefined) {
            this.focusedCell.editable();
            this.focusedCell._div.focus();
            this.editing = true;
        }
    };
    SelectionManager.prototype.endEdits = function () {
        this.editing = false;
    };
    return SelectionManager;
})();
//act like model class
var Spreadsheet = (function (_super) {
    __extends(Spreadsheet, _super);
    function Spreadsheet(width, height) {
        _super.call(this, 0 /* Horizontal */);
        this.handleSize = 1;
        this.cells = new Array();
        this.cellVals = new Array();
        for (var i = 1; i <= width; i++) {
            var panel = new SplitPanel(1 /* Vertical */);
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
    return Spreadsheet;
})(SplitPanel);
function main() {
    setup(15, 5);
}
function setup(width, height) {
    var spreadsheet = new Spreadsheet(width, height);
    spreadsheet.attach(document.getElementById('main'));
    //spCol.horizontalSizePolicy = SizePolicy.Fixed;
    spreadsheet.fit();
    window.onresize = function () { return spreadsheet.fit(); };
}
window.onload = main;
