import PIL
import os
import re
import math
import sys
import extcolors
import numpy as np
import json
from tkinter.filedialog import askopenfilename
import shutil
from PIL import ExifTags
import zipfile
import main
from pillow_heif import register_heif_opener
from tkinter import *
from tkinter import messagebox
from tkinter import ttk
from tkinter import Tk
from tkinter.filedialog import askdirectory


register_heif_opener()

orgRoot = None
secondWindow = None
directory = 'C:\\Users\\DareA\\Downloads\\PhotoOverhaul\\Photos'
saveDir = 'C:\\Users\\DareA\\Downloads\\PhotoOverhaul\\FinalPhotos\\{}'
dateSorted = 'C:\\Users\\DareA\\Downloads\\PhotoOverhaul\\SortedByDate\\{}'
imageTypes = ['heic', 'jpg', 'jpeg', 'png']
heicDates = {}
dates = {}
colors=['#eb4034', '#4287f5', '#42f563']
colorInt=0
textBox = None
listBox = None
chosenFolder = ''
recurse = None
filePathsToWorkWith = []
textBoxText = []
recursedFolders = []

class WidgetView:
    def __init__(this, widgetType, parent=None, widgetTitle='', widgetText='', widgetCommand=None, style=None):
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

def openPhotoOrganizerGUI():
    global textBox, listBox, recurse, orgRoot
    orgRoot = WidgetView('root', widgetTitle='Photo Organizer')
    #orgRoot.resizeWidget(1000,1000)
    s = ttk.Style()
    s.configure('red.TFrame', background='#454545')
    s.configure('orange.TFrame', background='#ffd6f1')
    s.configure('blue.TFrame', background='#454545')
    orgFrame = WidgetView('frame',orgRoot,style='orange.TFrame').insertIntoGrid(0, 0, stretch=True)#.resizeWidget(1,1,frac=True, depth=2)
    orgFrame.widget.columnconfigure(0, weight=1)
    orgFrame.widget.columnconfigure(1, weight=4)
    optionsFrame = WidgetView('frame',orgFrame,style='red.TFrame').insertIntoGrid(0, 0)#.resizeWidget(1,1,frac=True, depth=3)
    folderButton = WidgetView('button',optionsFrame, widgetText='Choose Folder', widgetCommand=openFolderChooser).insertIntoGrid(0, 0)
    randomLabel = WidgetView('label',optionsFrame, widgetText='Recursive Search?').insertIntoGrid(0, 1, pady=0)
    recursionFrame = WidgetView('frame', optionsFrame).insertIntoGrid(0,2,pady=0)
    recurse = BooleanVar(recursionFrame.widget, False)
    recursionTrue = Radiobutton(recursionFrame.widget, text='Yes', variable=recurse, value=True)
    recursionTrue.grid(column=0,row=0, pady=0)
    recursionFalse = Radiobutton(recursionFrame.widget, text='No', variable=recurse, value=False)
    recursionFalse.grid(column=1,row=0, pady=0)
    fileExplorerFrame = WidgetView('frame',orgFrame,style='blue.TFrame').insertIntoGrid(1, 0)#.resizeWidget(.5,.5,frac=True)
    fileExplorerFrame.widget.columnconfigure(0, weight=1)
    metadataButton = WidgetView('button',optionsFrame, widgetText='Show Metadata', widgetCommand=showMetaData).insertIntoGrid(0, 3)
    processButton = WidgetView('button',optionsFrame, widgetText='Process Photos', widgetCommand=openProcessPhotoWindow).insertIntoGrid(0, 4)
    quitButton = WidgetView('button',optionsFrame, widgetText='Quit', widgetCommand=orgRoot.widget.destroy).insertIntoGrid(0, 5)
    
    textBox = WidgetView('label', fileExplorerFrame, widgetText='').insertIntoGrid(0,0)#.resizeWidget(100,50)
    
    resetTextBoxText()
    listBox = WidgetView('listbox', fileExplorerFrame).insertIntoGrid(0,1).resizeWidget(120, 50)
    listBox.widget.bind('<<ListboxSelect>>', switchMetaData)
    addPathsToListBox()
    recurse.trace('w', recurseRadioSwitch)
    orgRoot.widget.mainloop()
    
def switchMetaData(a):
    global listBox
    print('switchMetaData',a)
def showMetaData():
    global filePathsToWorkWith, listBox
    mess = 'No photo selected!'
    if listBox.widget.curselection() and listBox.widget.curselection()[0] < len(filePathsToWorkWith):
        fileName = filePathsToWorkWith[listBox.widget.curselection()[0]]
        print(fileName)
        mess = ''
        try:
            img = PIL.Image.open(fileName)
            ifds = img.getexif()
            for tagId, val in ifds.items():
                tagName = PIL.Image.ExifTags.TAGS.get(tagId, tagId)
                mess += f'{tagName}: {val}\n'
        except:
            print()
    
    if mess == '':
        mess = 'No metadata'
    messagebox.showinfo('Metadata', mess)
def openProcessPhotoWindow():
    global filePathsToWorkWith, listBox, secondWindow, orgRoot
    mess = 'Select your options:'
    #messagebox.showinfo('Process Photos', mess)
    secondWindow = Toplevel(orgRoot.widget)
    secondWindow.title('Options')
    secondWindow.geometry('100x100')
    secondWindow.bind('<Escape>', secondWindowClosed)
    secondWindow.protocol('WM_DELETE_WINDOW', secondWindowClosed)
    secondWindow.grab_set()
    secondWindow.focus()
    #orgRoot.lock()
    
def secondWindowClosed(this=None):
    global secondWindow, orgRoot
    print('BLEH CLOSED')
    secondWindow.destroy()
    secondWindow.grab_release()
    #orgRoot.unlock()
    
def deleteAllFromListBox():
    global listBox
    listBox.widget.delete(0, listBox.widget.size())
def addPathsToListBox():
    global listBox, filePathsToWorkWith
    emptySpaces = 31 - len(filePathsToWorkWith)
    ind = 0
    for pat in filePathsToWorkWith:
        listBox.widget.insert(ind, pat)
        ind += 1
    print('emptySpaces', emptySpaces)
    if emptySpaces > 0:
        print('ADDING EMPTIES')
        for i in range(emptySpaces):
            listBox.widget.insert(ind, ' ')
            ind += 1
        
def resetTextBoxText(fold='', numIm=0):
    global textBoxText, textBox
    textBoxText = 'Chosen folder:\t\t\t\t\t\t\t\t\t\t\t\t\t\t\n\t{}\nNumber of images found: {}'.format(fold, numIm)
    textBox.widget['text'] = textBoxText
    
def resetFilePaths():
    global filePathsToWorkWith
    filePathsToWorkWith = []
    deleteAllFromListBox()
def resetRecursedFolders():
    global recursedFolders
    recursedFolders = []
    
def getFilesFromChosenFolder(fold=None):
    feFiles = os.listdir(fold) if fold else os.listdir(chosenFolder)
    if not fold:
        fold = chosenFolder
    i = 0
    for f in feFiles:
        fileExt = f.split('.')[-1] if '.' in f else ''
        wholePath = '{}/{}'.format(fold, f)
        if fileExt != '' and fileExt.lower() in imageTypes:
            filePathsToWorkWith.append(wholePath)
            i = i + 1

def getFilesFromChosenFolderRecurse(fold=None):
    global recursedFolders
    if not fold:
        fold = chosenFolder
    if fold in recursedFolders:
        return
    else:
        recursedFolders.append(fold)
    try:
        feFiles = os.listdir(fold)
    except:
        return
    for f in feFiles:
        fileExt = f.split('.')[-1] if '.' in f else ''
        wholePath = '{}/{}'.format(fold, f)
        print('fileExt', fileExt)
        print('wholePath', wholePath)
        if fileExt != '' and fileExt.lower() in imageTypes:
            filePathsToWorkWith.append(wholePath)
        elif fileExt == '' and os.path.isdir(wholePath):
            print(wholePath)
            getFilesFromChosenFolderRecurse(wholePath)
            
def recurseRadioSwitch(a,b,c):
    #print('recurseRadioSwitch',a,b,c)
    updateTextBox()
    
def updateTextBox():
    global textBoxText, recurse, recursedFolders
    resetTextBoxText()
    resetFilePaths()
    if recurse.get():
        resetRecursedFolders()
        getFilesFromChosenFolderRecurse()
    else:
        getFilesFromChosenFolder()
    addPathsToListBox()
    
    resetTextBoxText(chosenFolder, len(filePathsToWorkWith))
    
def openFolderChooser():
    global chosenFolder, textBox
    chosenFolder = askdirectory(title='Select Folder', mustexist=True)
    if chosenFolder:
        updateTextBox()


def newFolderWithNoDupes():
    images = []
    numIm = 0
    for filename in os.listdir(directory):
        if not filename.lower().endswith('.heic') and not filename.lower().endswith('.mp4') and not filename.lower().endswith('.mov') and not filename.lower().endswith('.py'):  # Look for PNG files
            oldFile = os.path.join(directory, filename)
            img = Image.open(oldFile)
            if img in images:
                print('DUPPPPEEE')
                #img.show()
            else:
                images.append(img)
                numIm = numIm + 1
                filename = 'joshley' + str(numIm) + '.' + filename.split('.')[-1]
                newFile = os.path.join(saveDir, filename)
                shutil.copyfile(oldFile, newFile)
                #print(img)
    print(f"Loaded {len(images)} images from {directory}")
def checkJpgVersion():
    for filename in os.listdir(directory):
        if filename.lower().endswith('.heic'):
            jpgVersion = ''.join(filename.split('.')[:-1]) + '.jpg'
            if not os.path.isfile(jpgVersion):
                newFile = os.path.join('C:\\Users\\DareA\\Downloads\\heics', filename)
                shutil.copyfile(os.path.join(directory, filename), newFile)
                print(filename)
            #else:
            #    print('NAH')

def convertHEICtoJPEG():
    heicFiles = [x for x in os.listdir(directory) if x.lower().endswith('.heic')]
    for hFile in heicFiles:
        img = Image.open(os.path.join(directory,hFile))
        ifds = img.getexif()
        if 306 in ifds:
            date = ifds[306].split(' ')[0].replace(':', '_')
            print(date)
            if '_' in date:
                year = date.split('_')[0]
            else:
                year = 'unknown'
        else:
            print('no date')
            date = 'unknown'
        if date not in dates:
            dates[date] = 0
        dates[date] = dates[date] + 1
        newFileName = date + '_' + str(dates[date]) + '.' + 'jpg'
        newFileDir = dateSorted.replace('{}', year)
        if not os.path.isdir(newFileDir):
            os.mkdir(newFileDir)
        newFile = os.path.join(newFileDir, newFileName)
        heicDates[hFile.replace('heic', 'jpg').replace('HEIC', 'jpg')] = newFile
        img.close()
    print(heicFiles)
    
    main.convert_heic_to_jpg(directory, 99, 4)
    for oldName in heicDates:
        moveToFolder(os.path.join(directory, oldName), heicDates[oldName])
        
    #execCommand = '"{}" {}'.format(os.path.join('C:\\Users\DareA\\photoManipulation','main.py'), directory).replace('\\\\', '\\')
    #print(execCommand)
    #print(execCommand.encode('unicode-escape'))
    #exec(execCommand)

def moveToFolder(fromDir, toDir, date=''):
    print('fromDir', fromDir)
    print('toDir', toDir)
    if not date:
        dateName = re.search('[0-9]{4}_[0-9]{2}_[0-9]{2}', toDir.split('\\')[-1])
        if dateName:
            date = dateName.group(0)
        else:
            date = 'unknown'
    print('date', date)
    dateFiles = [x for x in os.listdir('\\'.join(toDir.split('\\')[:-1])) if x.lower().startswith(date)]
    print(dateFiles)
    #shutil.move(fromDir, toDir)

def moveToYearFolders():
    images = []
    dates = {}
    convertHEICtoJPEG()

    for filename in os.listdir(directory):
        oldFile = os.path.join(directory, filename)
        fileType = oldFile.split('.')[-1].lower()
        print(fileType)
        if not os.path.isfile(oldFile) or fileType not in imageTypes or fileType == 'heic':
            print('exiting', fileType)
            continue
        year = 'unknown'
        img = Image.open(oldFile)
        images.append(img)
        ifds = img.getexif()
        if 306 in ifds:
            date = ifds[306].split(' ')[0].replace(':', '_')
            if '_' in date:
                year = date.split('_')[0]
        else:
            date = 'unknown'
        newFile = ''
        if date not in dates:
            dates[date] = 0
        img.close()
        dates[date] = dates[date] + 1
        newFileName = date + '.' + filename.split('.')[-1]
        newFile = os.path.join(dateSorted.replace('{}', year), newFileName)
        print(newFile)
        newFileDir = dateSorted.replace('{}', year)
        if not os.path.isdir(newFileDir):
            os.mkdir(newFileDir)
        moveToFolder(oldFile, newFile,date)
        #for k, v in img.getexif().items():
        #    print("Tag", k, "Value", v)
        
    
def renameUnknowns(fp, year):
    for filename in os.listdir(fp):
        if filename.startswith('unknown'):
            oldFile = os.path.join(fp, filename)
            newFile = os.path.join(fp, str(year) + '_' + filename.split('_')[-1])
            shutil.copyfile(oldFile, newFile)
#newFolderWithNoDupes()
##getDates()
#moveToYearFolders()
openPhotoOrganizerGUI()