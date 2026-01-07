from tkinter import ttk
from tkinter import Tk
from tkinter import *
import sys
class WidgetWrapper:
    def __init__(this, widgetType, parent=None, widgetTitle='', widgetText='', widgetCommand=None, style=None, variable=None):
        this.parent = parent
        this.pady = 0
        this.padx = 0
        this.cumulativePady = 0
        this.cumulativePadx = 0
        if widgetType == 'root':
            this.widget = Tk()
        elif widgetType == 'frame':
            if not parent:
                print('NEEDS PARENT WIDGET')
                sys.exit(-1)
            this.widget = ttk.Frame(parent.widget, padding=10, style=style)
            this.pady = 10
            this.padx = 10
            this.cumulativePady = this.pady if not this.parent else this.pady + this.parent.cumulativePady
            this.cumulativePadx = this.padx if not this.parent else this.padx + this.parent.cumulativePadx
            #colorInt += 1
        elif widgetType == 'label':
            if not parent:
                print('NEEDS PARENT WIDGET')
                sys.exit(-1)
            this.widget = ttk.Label(parent.widget, text=widgetText)
        elif widgetType == 'listbox':
            if not parent:
                print('NEEDS PARENT WIDGET')
                sys.exit(-1)
            this.widget = Listbox(parent.widget)
        elif widgetType == 'text':
            if not parent:
                print('NEEDS PARENT WIDGET')
                sys.exit(-1)
            this.widget = Text(parent.widget)
        elif widgetType == 'button':
            if not parent:
                print('NEEDS PARENT WIDGET')
                sys.exit(-1)
            this.widget = ttk.Button(parent.widget, text=widgetText, command=widgetCommand)
        elif widgetType == 'radio':
            if not parent:
                print('NEEDS PARENT WIDGET')
                sys.exit(-1)
            this.widget = Radiobutton(parent.widget, text=widgetText, variable=variable, value=False)
        
        if widgetTitle:
            this.widget.title(widgetTitle)
    def insertIntoGrid(this, col=-1, r=-1,stretch=False, padx=10, pady=10):
        if col >= 0 and r >= 0:
            if stretch:
                this.widget.grid(column=col, row=r, sticky=(N, S, E, W))
            else:
                this.widget.grid(column=col, row=r)
            this.widget.grid_configure(padx=padx, pady=pady)
            this.pady = 10
            this.padx = 10
        else:
            this.widget.grid(sticky=(N, S, E, W))
        this.cumulativePady = this.pady if not this.parent else this.pady + this.parent.cumulativePady
        this.cumulativePadx = this.padx if not this.parent else this.padx + this.parent.cumulativePadx
        return this

    def resizeWidget(this,x=-1,y=-1,frac=False, depth=0):
        if frac:
            print('x and y fraction:',x,y)
            this.parent.widget.update_idletasks()
            parentWidth = this.parent.widget.winfo_width()
            parentHeight = this.parent.widget.winfo_height()
            print('parent sizes:', parentWidth, parentHeight)
            x = int((1000-(depth*20)) * x)
            y = int((1000-(depth*20)) * y)
            print('x and y after:',x,y)
        this.widget.update_idletasks()
        try:
            this.widget.geometry('{}x{}+0+0'.format(x,y))
        except:
            this.widget.configure(width=x, height=y)
        return this
    def printSize(this):
        this.widget.update_idletasks()
        print('width:', this.widget.winfo_width())
        print('height:', this.widget.winfo_height())
        return this
    def lock(this):
        this.widget.grab_set()
        print('LOCKED')
        return this
    def unlock(this):
        this.widget.grab_release()
        print('UNLOCKED')
        return this
    def unshow(this):
        this.widget.withdraw()
        return this
    def show(this):
        this.widget.deiconify()
        return this
