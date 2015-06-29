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
    this._div.text(this._sheet.getCellVal(this._cellx - 1, this._celly - 1));
  }
  pushBack() {
    this._sheet.setCellVal(this._cellx - 1, this._celly - 1, this._div.text());
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
        if (typeof e.target !== 'undefined' && 
          typeof manager.focusedCell != 'undefined') {
          var cell = <Cell>$(e.target).data("cell");
          if(manager.mouseDown && typeof cell !== 'undefined' && 
            !manager.editing) {
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
        if (typeof e.target !== 'undefined' && 
          typeof $(e.target).data('cell') !== 'undefined') {
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
                if (manager.maxX < sheet.getWidth()) {
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
                if (manager.maxY < sheet.getHeight()) {
                  manager.maxY++;
                  manager.selectArea();
                }
              }
            }
            break;
          case 9: //tab
            e.preventDefault(); //check focus on this one...
            if (e.shiftKey) {
              manager.move(true, -1, 0);
            }
            else {
              manager.move(true, 1, 0);
            }
            break;
          default:
            if (!manager.editing && e.keyCode >= 32 && e.keyCode != 127 
              && !e.altKey && !e.ctrlKey) {
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
              if (manager.minX + j <= sheet.getWidth() 
                && manager.minY + i <= sheet.getHeight()) {
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

  insertRow(rowNum: number) {
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
  }

  insertCol(colNum: number) {
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
  }

  deleteRow(rowNum : number) {
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

  }

  deleteCol(colNum : number) {
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
        delRow: function() {
          console.log("Delete row"); 
          manager.deleteRow(manager.focusedCell._celly);
        },
        delCol: function() {
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
        delColItem]);
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
        this.select(this.sheet.getCell(i - 1, j - 1));
      }
    }
  }

  selectRow(rowNum: number) {
    for (var i = 0; i < this.sheet.getWidth(); i++) {
      this.select(this.sheet.getCell(i, rowNum));
    }
    this.sheet.getCell(0, rowNum).focus();
    this.focusedCell = this.sheet.getCell(0, rowNum);
    this.minX = 1;
    this.maxX = this.sheet.getWidth();
    this.minY = rowNum;
    this.maxY = rowNum;
  }

  selectCol(colNum: number) {
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
  }


  clearCell (cell : Cell) {
    cell._sheet.setCellVal(cell._cellx - 1, cell._celly - 1, "");
    cell.updateView();
  }

  move(skipCheck : boolean, xAmount : number, yAmount : number) {
    if (typeof this.focusedCell !== 'undefined' && 
      this.focusedCell._cellx + xAmount > 0 && 
      this.focusedCell._cellx + xAmount <= this.sheet.getWidth() && 
      this.focusedCell._celly + yAmount > 0 && 
      this.focusedCell._celly + yAmount <= this.sheet.getHeight()) {
      if (!this.editing || skipCheck) {
        this.clearSelections();
        this.focusedCell.pushBack();
        this.focusedCell._div.removeClass('focused');

        var cell = this.sheet.getCell(this.focusedCell._cellx - 1 + xAmount, 
          this.focusedCell._celly - 1 + yAmount);
        this.focusCell(cell);
      }
    }
  }
  setCell(x : number, y : number, newVal : string) {
    this.sheet.setCellVal(x, y, newVal);
    this.sheet.getCell(x, y).updateView();
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
  private columns: SplitPanel[];
  private cells : Cell[][];
  private labels: Label[];
  private cellVals : string[][];
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

  getColumn(colNum : number): SplitPanel {
    return this.columns[colNum];
  }
  getColumnLength(): number {
    return this.columns.length;
  }
  getLabel(idx: number): Label {
    return this.labels[idx];
  }
  getLabelCount(): number {
    return this.labels.length;
  }
  delLabel(idx: number) {
    this.labels[idx].dispose();
    this.labels.splice(idx, 1);
  }
  getCell(x : number, y : number): Cell {
    return this.cells[x][y];
  }
  getWidth(): number {
    return this.cells.length;
  }
  getHeight(): number {
    return this.cells[0].length;
  }
  getCellVal(x: number, y: number): string {
    return this.cellVals[x][y];
  }
  setCellVal(x: number, y: number, newVal: string) {
    this.cellVals[x][y] = newVal;
  }
  insertRow(rowNum: number) {

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
  }

  insertCol(colNum: number) {
    var panel = new SplitPanel(Orientation.Vertical);
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
  }
  deleteRow(rowNum: number) {
    for (var i = 1; i < this.columns.length; i++) {
      for (var j = rowNum; j < this.cells[i - 1].length; j++) {
        this.cells[i - 1][j]._celly--;
      }
      this.cells[i - 1][rowNum - 1].dispose();
      this.cells[i - 1].splice(rowNum - 1, 1);
      this.cellVals[i - 1].splice(rowNum - 1, 1);
    }
  }
  deleteCol(colNum: number) {
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