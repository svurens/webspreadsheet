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
TODO
-Should make preventDefault only happen if focused on the spreadsheet.
-Make cells extend for longer text
-Shift-arrow highlighting
*/
/*known bugs
-Internet Explorer mystery focus on click
*/
function is(type, obj) {
    var clas = Object.prototype.toString.call(obj).slice(8, -1);
    return obj !== undefined && obj !== null && clas === type;
}
var Label = (function (_super) {
    __extends(Label, _super);
    function Label(isCol, num) {
        _super.call(this);
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
        this.verticalSizePolicy = 0 /* Fixed */;
        this.horizontalSizePolicy = SizePolicy.MinimumExpanding;
    }
    return Label;
})(Widget);
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
                if (is('HTMLDivElement', e.target)) {
                    var cell = $(e.target).data("cell");
                    var label = $(e.target).data("label");
                    if (cell != undefined) {
                        manager.mouseDown = true;
                        manager.removeFocus();
                        manager.clearSelections();
                        manager.focusCell(cell);
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
            sheet.node.addEventListener("mousemove", function (e) {
                if (e.target != undefined && manager.focusedCell != undefined) {
                    var cell = $(e.target).data("cell");
                    if (manager.mouseDown && cell != undefined && !manager.editing) {
                        if (cell._cellx != manager.focusedCell._cellx || cell._celly != manager.focusedCell._celly) {
                            document.getSelection().removeAllRanges();
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
            $(window).mouseup(function (e) {
                manager.mouseDown = false;
            });
            /* -------------- DOUBLE CLICK ---------------------*/
            sheet.node.addEventListener("dblclick", function (e) {
                if (e.target != undefined && $(e.target).data('cell') != undefined) {
                    manager.beginEdits();
                }
            });
            /* --------------------KEY PRESS -----------------------*/
            window.addEventListener("keydown", function (e) {
                switch (e.keyCode) {
                    case 13:
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
                    case 8:
                    case 46:
                        console.log("backspace pressed");
                        if (!manager.editing) {
                            e.preventDefault();
                            for (var i = 0; i < manager.selectedCells.length; i++) {
                                manager.clearCell(manager.selectedCells[i]);
                            }
                        }
                        break;
                    case 37:
                        if (!e.shiftKey) {
                            manager.move(false, -1, 0);
                        }
                        break;
                    case 38:
                        if (!e.shiftKey) {
                            manager.move(false, 0, -1);
                        }
                        break;
                    case 39:
                        if (!e.shiftKey) {
                            manager.move(false, 1, 0);
                        }
                        break;
                    case 40:
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
            window.addEventListener("copy", function (e) {
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
            window.addEventListener("paste", function (e) {
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
    SelectionManager.prototype.removeFocus = function () {
        if (this.focusedCell != undefined) {
            console.log(this.focusedCell);
            this.focusedCell._div.removeClass('focused');
        }
    };
    SelectionManager.prototype.focusCell = function (cell) {
        this.minX = cell._cellx;
        this.maxX = cell._cellx;
        this.minY = cell._celly;
        this.maxY = cell._celly;
        cell.focus();
        this.focusedCell = cell;
        this.select(cell);
    };
    SelectionManager.prototype.selectRow = function (rowNum) {
        for (var i = 0; i < this.sheet.cells.length; i++) {
            this.select(this.sheet.cells[i][rowNum]);
        }
        this.sheet.cells[0][rowNum].focus();
        this.focusedCell = this.sheet.cells[0][rowNum];
        this.minX = 1;
        this.maxX = this.sheet.cells.length;
        this.minY = rowNum;
        this.maxY = rowNum;
    };
    SelectionManager.prototype.selectCol = function (colNum) {
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
    };
    SelectionManager.prototype.clearCell = function (cell) {
        cell._sheet.cellVals[cell._cellx - 1][cell._celly - 1] = "";
        cell.updateView();
    };
    SelectionManager.prototype.move = function (skipCheck, xAmount, yAmount) {
        if (this.focusedCell != undefined && this.focusedCell._cellx + xAmount > 0 && this.focusedCell._cellx + xAmount <= this.sheet.cells.length && this.focusedCell._celly + yAmount > 0 && this.focusedCell._celly + yAmount <= this.sheet.cells[0].length) {
            if (!this.editing || skipCheck) {
                this.clearSelections();
                this.focusedCell.pushBack();
                this.focusedCell._div.removeClass('focused');
                var cell = this.getCell(this.focusedCell._cellx - 1 + xAmount, this.focusedCell._celly - 1 + yAmount);
                this.focusCell(cell);
            }
        }
    };
    SelectionManager.prototype.getCell = function (x, y) {
        return this.sheet.cells[x][y];
    };
    SelectionManager.prototype.setCell = function (x, y, newVal) {
        this.sheet.cellVals[x][y] = newVal;
        this.getCell(x, y).updateView();
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
        var colPanel = new SplitPanel(1 /* Vertical */);
        colPanel.addWidget(new Label(true, -1));
        for (var i = 1; i <= height; i++) {
            colPanel.addWidget(new Label(false, i));
        }
        this.addWidget(colPanel);
        for (var i = 1; i <= width; i++) {
            var panel = new SplitPanel(1 /* Vertical */);
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
    return Spreadsheet;
})(SplitPanel);
function main() {
    setup(15, 53);
}
function setup(width, height) {
    var spreadsheet = new Spreadsheet(width, height);
    spreadsheet.attach(document.getElementById('main'));
    //spCol.horizontalSizePolicy = SizePolicy.Fixed;
    spreadsheet.fit();
    window.onresize = function () { return spreadsheet.fit(); };
}
window.onload = main;
