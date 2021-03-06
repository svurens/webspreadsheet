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
var Menu = phosphor.widgets.Menu;
var MenuBar = phosphor.widgets.MenuBar;
var MenuItem = phosphor.widgets.MenuItem;
var connect = phosphor.core.connect;
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
        this.updateText();
        this._div.appendTo(this.node);
        this._div.addClass('label');
        this._div.data("label", this);
        this.addClass('content');
        this.verticalSizePolicy = 0 /* Fixed */;
        this.horizontalSizePolicy = SizePolicy.MinimumExpanding;
    }
    Label.prototype.rowInserted = function () {
        if (!this.isCol) {
            this.num++;
            this.updateText();
        }
    };
    Label.prototype.colInserted = function () {
        if (this.isCol) {
            this.num++;
            this.updateText();
        }
    };
    Label.prototype.rowDeleted = function () {
        if (!this.isCol) {
            this.num--;
            this.updateText();
        }
    };
    Label.prototype.colDeleted = function () {
        if (this.isCol) {
            this.num--;
            this.updateText();
        }
    };
    Label.prototype.updateText = function () {
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
    };
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
        this._div.text(this._sheet.getCellVal(this._cellx - 1, this._celly - 1));
    };
    Cell.prototype.pushBack = function () {
        this._sheet.setCellVal(this._cellx - 1, this._celly - 1, this._div.text());
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
            sheet.node.addEventListener("mousemove", function (e) {
                if (typeof e.target !== 'undefined' && typeof manager.focusedCell != 'undefined') {
                    var cell = $(e.target).data("cell");
                    if (manager.mouseDown && typeof cell !== 'undefined' && !manager.editing) {
                        manager.mouseSelectRange(cell);
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
                if (typeof e.target !== 'undefined' && typeof $(e.target).data('cell') !== 'undefined') {
                    manager.beginEdits();
                }
            });
            /* --------------------KEY PRESS -----------------------*/
            window.addEventListener("keydown", function (e) {
                switch (e.keyCode) {
                    case 13:
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
                    case 38:
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
                    case 39:
                        if (!e.shiftKey) {
                            manager.move(false, 1, 0);
                        }
                        else {
                            if (manager.minX < manager.focusedCell._cellx) {
                                manager.minX++;
                                manager.selectArea();
                            }
                            else {
                                if (manager.maxX < sheet.getWidth()) {
                                    manager.maxX++;
                                    manager.selectArea();
                                }
                            }
                        }
                        break;
                    case 40:
                        if (!e.shiftKey) {
                            manager.move(false, 0, 1);
                        }
                        else {
                            if (manager.minY < manager.focusedCell._celly) {
                                manager.minY++;
                                manager.selectArea();
                            }
                            else {
                                if (manager.maxY < sheet.getHeight()) {
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
            window.addEventListener("copy", function (e) {
                var str = "";
                for (var i = manager.minY; i <= manager.maxY; i++) {
                    for (var j = manager.minX; j <= manager.maxX; j++) {
                        str = str + manager.sheet.getCell(j - 1, i - 1)._div.text();
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
                            if (manager.minX + j <= sheet.getWidth() && manager.minY + i <= sheet.getHeight()) {
                                if (typeof cells[j] !== 'undefined') {
                                    manager.setCell(manager.minX + j - 1, manager.minY + i - 1, cells[j]);
                                }
                                else {
                                    manager.setCell(manager.minX + j - 1, manager.minY + i - 1, "");
                                }
                                manager.select(manager.sheet.getCell(manager.minX + j - 1, manager.minY + i - 1));
                            }
                        }
                    }
                    manager.maxX = manager.minX + maxW - 1;
                    manager.maxY = manager.minY + lines.length - 1;
                    manager.removeFocus();
                    manager.focusCell(manager.sheet.getCell(manager.minX - 1, manager.minY - 1));
                }
            });
        })(this.sheet, this);
        this.focusCell(this.sheet.getCell(0, 0));
        this.createMenu();
    }
    SelectionManager.prototype.insertRow = function (rowNum) {
        for (var i = 0; i < this.sheet.getLabelCount(); i++) {
            if (this.sheet.getLabel(i).num >= rowNum) {
                this.sheet.getLabel(i).rowInserted();
            }
        }
        this.sheet.insertRow(rowNum);
        // for (var i = 1; i < this.sheet.columns.length; i++) {
        //   this.sheet.cellVals[i - 1].splice(rowNum - 1, 0, "");
        //   var cell = new Cell(this.sheet, i, rowNum);
        //   this.sheet.cells[i - 1].splice(rowNum - 1, 0, cell);
        //   this.sheet.columns[i].insertWidget(rowNum, cell);
        //   for (var j = rowNum; j < this.sheet.cells[i - 1].length; j++) {
        //     this.sheet.cells[i - 1][j]._celly++;
        //   }
        // }
        this.removeFocus();
        this.clearSelections();
        this.selectRow(rowNum - 1);
    };
    SelectionManager.prototype.insertCol = function (colNum) {
        for (var i = 0; i < this.sheet.getLabelCount(); i++) {
            if (this.sheet.getLabel(i).num >= colNum) {
                this.sheet.getLabel(i).colInserted();
            }
        }
        // var panel = new SplitPanel(Orientation.Vertical);
        // this.sheet.insertWidget(colNum, panel);
        // var label = new Label(true, colNum);
        // panel.addWidget(label);
        // this.sheet.labels.push(label);
        // this.sheet.columns.splice(colNum, 0, panel);
        // for (var i = colNum - 1; i < this.sheet.cells.length; i++) {
        //   for (var j = 0; j < this.sheet.cells[0].length; j++) {
        //     this.sheet.cells[i][j]._cellx++;
        //   }
        // }
        // var len = this.sheet.cells[0].length;
        // this.sheet.cells.splice(colNum - 1, 0, new Array());
        // this.sheet.cellVals.splice(colNum - 1, 0, new Array());
        // for (var i = 0; i < len; i++) {
        //   var cell = new Cell(this.sheet, colNum, i + 1);
        //   cell.width = this.focusedCell.width;
        //   panel.addWidget(cell);
        //   this.sheet.cellVals[colNum - 1].push("");
        //   this.sheet.cells[colNum - 1].push(cell);
        // }
        this.sheet.insertCol(colNum);
        this.removeFocus();
        this.clearSelections();
        this.selectCol(colNum - 1);
    };
    SelectionManager.prototype.deleteRow = function (rowNum) {
        for (var i = 0; i < this.sheet.getLabelCount(); i++) {
            if (this.sheet.getLabel(i).num == rowNum && !this.sheet.getLabel(i).isCol) {
                this.sheet.delLabel(i--);
            }
            else if (this.sheet.getLabel(i).num > rowNum) {
                this.sheet.getLabel(i).rowDeleted();
            }
        }
        //  for (var i = 1; i < this.sheet.columns.length; i++) {
        // for (var j = rowNum; j < this.sheet.cells[i - 1].length; j++) {
        //      this.sheet.cells[i - 1][j]._celly--;
        //    }
        //    this.sheet.cells[i - 1][rowNum - 1].dispose();
        //    this.sheet.cells[i - 1].splice(rowNum - 1, 1);
        //    this.sheet.cellVals[i - 1].splice(rowNum - 1, 1);
        //  }
        this.sheet.deleteRow(rowNum);
        console.log(this.focusedCell);
        this.removeFocus();
        this.clearSelections();
        if (this.sheet.getHeight() < rowNum) {
            this.selectRow(rowNum - 2);
        }
        else {
            this.selectRow(rowNum - 1);
        }
    };
    SelectionManager.prototype.deleteCol = function (colNum) {
        for (var i = 0; i < this.sheet.getLabelCount(); i++) {
            if (this.sheet.getLabel(i).num == colNum && this.sheet.getLabel(i).isCol) {
                this.sheet.delLabel(i--);
            }
            else if (this.sheet.getLabel(i).num > colNum) {
                this.sheet.getLabel(i).colDeleted();
            }
        }
        // for (var i = colNum; i < this.sheet.cells.length; i++) {
        //   for (var j = 0; j < this.sheet.cells[0].length; j++) {
        //     this.sheet.cells[i][j]._cellx--;
        //   }
        // }
        // while (this.sheet.cells[colNum - 1].length > 0) {
        //   this.sheet.cells[colNum - 1][0].dispose();
        //   this.sheet.cells[colNum - 1].splice(0, 1);
        //   this.sheet.cellVals[colNum - 1].splice(0, 1);
        // }
        // this.sheet.cells.splice(colNum - 1, 1);
        // this.sheet.columns[colNum].dispose();
        // this.sheet.columns.splice(colNum, 1);
        this.sheet.deleteCol(colNum);
        this.removeFocus();
        this.clearSelections();
        if (this.sheet.getWidth() < colNum) {
            this.selectCol(colNum - 2);
        }
        else {
            this.selectCol(colNum - 1);
        }
    };
    SelectionManager.prototype.createMenu = function () {
        (function (manager) {
            var handler = {
                rowBefore: function () {
                    console.log("Add row before");
                    manager.insertRow(manager.focusedCell._celly);
                },
                rowAfter: function () {
                    console.log("Add row after");
                    manager.insertRow(manager.focusedCell._celly + 1);
                },
                colBefore: function () {
                    console.log("Add col before");
                    manager.insertCol(manager.focusedCell._cellx);
                },
                colAfter: function () {
                    console.log("Add col after");
                    manager.insertCol(manager.focusedCell._cellx + 1);
                },
                delRow: function () {
                    console.log("Delete row");
                    manager.deleteRow(manager.focusedCell._celly);
                },
                delCol: function () {
                    console.log("Delete col");
                    manager.deleteCol(manager.focusedCell._cellx);
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
            var delRowItem = new MenuItem({
                text: "Delete Row",
                className: 'delRow'
            });
            var delColItem = new MenuItem({
                text: "Delete Column",
                className: 'delCol'
            });
            connect(rowBeforeItem, MenuItem.triggered, handler, handler.rowBefore);
            connect(rowAfterItem, MenuItem.triggered, handler, handler.rowAfter);
            connect(colBeforeItem, MenuItem.triggered, handler, handler.colBefore);
            connect(colAfterItem, MenuItem.triggered, handler, handler.colAfter);
            connect(delRowItem, MenuItem.triggered, handler, handler.delRow);
            connect(delColItem, MenuItem.triggered, handler, handler.delCol);
            var rightClickMenu = new Menu([
                rowBeforeItem,
                rowAfterItem,
                colBeforeItem,
                colAfterItem,
                delRowItem,
                delColItem
            ]);
            document.addEventListener('contextmenu', function (event) {
                event.preventDefault();
                var x = event.clientX;
                var y = event.clientY;
                rightClickMenu.popup(x, y);
            });
        })(this);
    };
    SelectionManager.prototype.removeFocus = function () {
        if (typeof this.focusedCell !== 'undefined') {
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
    SelectionManager.prototype.mouseSelectRange = function (target) {
        if (target._cellx != this.focusedCell._cellx || target._celly != this.focusedCell._celly) {
            document.getSelection().removeAllRanges();
        }
        this.minX = Math.min(target._cellx, this.focusedCell._cellx);
        this.maxX = Math.max(target._cellx, this.focusedCell._cellx);
        this.minY = Math.min(target._celly, this.focusedCell._celly);
        this.maxY = Math.max(target._celly, this.focusedCell._celly);
        this.selectArea();
    };
    SelectionManager.prototype.selectArea = function () {
        this.clearSelections();
        for (var i = this.minX; i <= this.maxX; i++) {
            for (var j = this.minY; j <= this.maxY; j++) {
                this.select(this.sheet.getCell(i - 1, j - 1));
            }
        }
    };
    SelectionManager.prototype.selectRow = function (rowNum) {
        for (var i = 0; i < this.sheet.getWidth(); i++) {
            this.select(this.sheet.getCell(i, rowNum));
        }
        this.sheet.getCell(0, rowNum).focus();
        this.focusedCell = this.sheet.getCell(0, rowNum);
        this.minX = 1;
        this.maxX = this.sheet.getWidth();
        this.minY = rowNum;
        this.maxY = rowNum;
    };
    SelectionManager.prototype.selectCol = function (colNum) {
        if (colNum >= 0) {
            for (var i = 0; i < this.sheet.getHeight(); i++) {
                this.select(this.sheet.getCell(colNum, i));
            }
            this.sheet.getCell(colNum, 0).focus();
            this.focusedCell = this.sheet.getCell(colNum, 0);
            this.minY = 1;
            this.maxY = this.sheet.getHeight();
            this.minX = colNum;
            this.maxX = colNum;
        }
    };
    SelectionManager.prototype.clearCell = function (cell) {
        cell._sheet.setCellVal(cell._cellx - 1, cell._celly - 1, "");
        cell.updateView();
    };
    SelectionManager.prototype.move = function (skipCheck, xAmount, yAmount) {
        if (typeof this.focusedCell !== 'undefined' && this.focusedCell._cellx + xAmount > 0 && this.focusedCell._cellx + xAmount <= this.sheet.getWidth() && this.focusedCell._celly + yAmount > 0 && this.focusedCell._celly + yAmount <= this.sheet.getHeight()) {
            if (!this.editing || skipCheck) {
                this.clearSelections();
                this.focusedCell.pushBack();
                this.focusedCell._div.removeClass('focused');
                var cell = this.sheet.getCell(this.focusedCell._cellx - 1 + xAmount, this.focusedCell._celly - 1 + yAmount);
                this.focusCell(cell);
            }
        }
    };
    SelectionManager.prototype.setCell = function (x, y, newVal) {
        this.sheet.setCellVal(x, y, newVal);
        this.sheet.getCell(x, y).updateView();
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
        if (typeof this.focusedCell !== 'undefined') {
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
        this.columns = new Array();
        this.labels = new Array();
        this.handleSize = 1;
        this.cells = new Array();
        this.cellVals = new Array();
        var panel = new SplitPanel(1 /* Vertical */);
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
            panel = new SplitPanel(1 /* Vertical */);
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
    Spreadsheet.prototype.getColumn = function (colNum) {
        return this.columns[colNum];
    };
    Spreadsheet.prototype.getColumnLength = function () {
        return this.columns.length;
    };
    Spreadsheet.prototype.getLabel = function (idx) {
        return this.labels[idx];
    };
    Spreadsheet.prototype.getLabelCount = function () {
        return this.labels.length;
    };
    Spreadsheet.prototype.delLabel = function (idx) {
        this.labels[idx].dispose();
        this.labels.splice(idx, 1);
    };
    Spreadsheet.prototype.getCell = function (x, y) {
        return this.cells[x][y];
    };
    Spreadsheet.prototype.getWidth = function () {
        return this.cells.length;
    };
    Spreadsheet.prototype.getHeight = function () {
        return this.cells[0].length;
    };
    Spreadsheet.prototype.getCellVal = function (x, y) {
        return this.cellVals[x][y];
    };
    Spreadsheet.prototype.setCellVal = function (x, y, newVal) {
        this.cellVals[x][y] = newVal;
    };
    Spreadsheet.prototype.insertRow = function (rowNum) {
        var label = new Label(false, rowNum);
        this.columns[0].insertWidget(rowNum, label);
        this.labels.push(label);
        for (var i = 1; i < this.columns.length; i++) {
            this.cellVals[i - 1].splice(rowNum - 1, 0, "");
            var cell = new Cell(this, i, rowNum);
            this.cells[i - 1].splice(rowNum - 1, 0, cell);
            this.columns[i].insertWidget(rowNum, cell);
            for (var j = rowNum; j < this.cells[i - 1].length; j++) {
                this.cells[i - 1][j]._celly++;
            }
        }
    };
    Spreadsheet.prototype.insertCol = function (colNum) {
        var panel = new SplitPanel(1 /* Vertical */);
        this.insertWidget(colNum, panel);
        var label = new Label(true, colNum);
        panel.addWidget(label);
        this.labels.push(label);
        this.columns.splice(colNum, 0, panel);
        for (var i = colNum - 1; i < this.cells.length; i++) {
            for (var j = 0; j < this.cells[0].length; j++) {
                this.cells[i][j]._cellx++;
            }
        }
        var len = this.cells[0].length;
        this.cells.splice(colNum - 1, 0, new Array());
        this.cellVals.splice(colNum - 1, 0, new Array());
        for (var i = 0; i < len; i++) {
            var cell = new Cell(this, colNum, i + 1);
            panel.addWidget(cell);
            this.cellVals[colNum - 1].push("");
            this.cells[colNum - 1].push(cell);
        }
    };
    Spreadsheet.prototype.deleteRow = function (rowNum) {
        for (var i = 1; i < this.columns.length; i++) {
            for (var j = rowNum; j < this.cells[i - 1].length; j++) {
                this.cells[i - 1][j]._celly--;
            }
            this.cells[i - 1][rowNum - 1].dispose();
            this.cells[i - 1].splice(rowNum - 1, 1);
            this.cellVals[i - 1].splice(rowNum - 1, 1);
        }
    };
    Spreadsheet.prototype.deleteCol = function (colNum) {
        for (var i = colNum; i < this.cells.length; i++) {
            for (var j = 0; j < this.cells[0].length; j++) {
                this.cells[i][j]._cellx--;
            }
        }
        while (this.cells[colNum - 1].length > 0) {
            console.log(this.cells[colNum - 1].length);
            this.cells[colNum - 1][0].dispose();
            this.cells[colNum - 1].splice(0, 1);
            this.cellVals[colNum - 1].splice(0, 1);
        }
        this.cells.splice(colNum - 1, 1);
        this.columns[colNum].dispose();
        this.columns.splice(colNum, 1);
    };
    return Spreadsheet;
})(SplitPanel);
function main() {
    setup(15, 27);
}
function setup(width, height) {
    var spreadsheet = new Spreadsheet(width, height);
    spreadsheet.attach(document.getElementById('main'));
    //spCol.horizontalSizePolicy = SizePolicy.Fixed;
    spreadsheet.fit();
    window.onresize = function () { return spreadsheet.fit(); };
}
window.onload = main;
