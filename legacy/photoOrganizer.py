import PIL
import os
import re
#import math
#import sys
#import extcolors
#import numpy as np
#import json
#from tkinter.filedialog import askopenfilename
import shutil
#from PIL import ExifTags
#import zipfile
import main
from pillow_heif import register_heif_opener
from tkinter import *
from tkinter import ttk
from tkinter.filedialog import askdirectory
from widgetWrapper import WidgetWrapper, createMessageBox, openProcessPhotoWindow

register_heif_opener()

rootWindow = None
processWindow = None
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
isRecursive = None
filePathsToWorkWith = []
textBoxText = []
isRecursivedFolders = []

def configureStyles():
    s = ttk.Style()
    s.configure('gray.TFrame', background='#454545')
    s.configure('pink.TFrame', background='#ffd6f1')
    s.configure('dkpink.TFrame', background="#ffade4")
    
def openPhotoOrganizerGUI():
    global textBox, listBox, isRecursive, rootWindow
    rootWindow = WidgetWrapper('root', widgetTitle='Photo Organizer')
    configureStyles()
    #rootWindow.resizeWidget(1000,1000)
    layoutFrame = WidgetWrapper('frame',rootWindow,style='pink.TFrame').insertIntoGrid(0, 0, stretch=True)#.resizeWidget(1,1,frac=True, depth=2)
    layoutFrame.widget.columnconfigure(0, weight=1)
    layoutFrame.widget.columnconfigure(1, weight=4)
    
    leftOptionsFrame = WidgetWrapper('frame',layoutFrame,style='gray.TFrame').insertIntoGrid(0, 0)#.resizeWidget(1,1,frac=True, depth=3)
    
    chooseFolderButton = WidgetWrapper('button',leftOptionsFrame, widgetText='Choose Folder', widgetCommand=openFolderChooser).insertIntoGrid(0, 0)
    
    recursiveSearchLabel = WidgetWrapper('label',leftOptionsFrame, widgetText='Recursive Search?').insertIntoGrid(0, 1, pady=0)
    
    recursionFrame = WidgetWrapper('frame', leftOptionsFrame).insertIntoGrid(0,2,pady=0)
    
    isRecursive = WidgetWrapper('booleanvar', recursionFrame, variable=False).widget
    
    recursionTrueRadio = WidgetWrapper('radio', recursionFrame, widgetText='Yes', variable=isRecursive).insertIntoGrid(0,0,pady=0)
    
    recursionFalseRadio = WidgetWrapper('radio', recursionFrame, widgetText='No', value=True).insertIntoGrid(1,0,pady=0)
    
    rightFileExplorerFrame = WidgetWrapper('frame',layoutFrame,style='gray.TFrame').insertIntoGrid(1, 0)#.resizeWidget(.5,.5,frac=True)
    rightFileExplorerFrame.widget.columnconfigure(0, weight=1)
    
    metadataButton = WidgetWrapper('button',leftOptionsFrame, widgetText='Show Metadata', widgetCommand=showMetaData).insertIntoGrid(0, 3)
    processButton = WidgetWrapper('button',leftOptionsFrame, widgetText='Process Photos', widgetCommand=lambda: openProcessPhotoWindow(rootWindow)).insertIntoGrid(0, 4)
    quitButton = WidgetWrapper('button',leftOptionsFrame, widgetText='Quit', widgetCommand=rootWindow.widget.destroy).insertIntoGrid(0, 5)
    
    textBox = WidgetWrapper('label', rightFileExplorerFrame, widgetText='BLEH').insertIntoGrid(0,0)#.resizeWidget(100,50)
    
    resetTextBoxText()
    listBox = WidgetWrapper('listbox', rightFileExplorerFrame).insertIntoGrid(0,1).resizeWidget(120, 50)
    listBox.widget.bind('<<ListboxSelect>>', switchMetaData)
    addPathsToListBox()
    isRecursive.trace('w', isRecursiveRadioSwitch)
    rootWindow.widget.mainloop()
    
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
    createMessageBox('Metadata', mess)
    
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
    global isRecursivedFolders
    isRecursivedFolders = []
    
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
    global isRecursivedFolders
    if not fold:
        fold = chosenFolder
    if fold in isRecursivedFolders:
        return
    else:
        isRecursivedFolders.append(fold)
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
            
def isRecursiveRadioSwitch(a,b,c):
    #print('isRecursiveRadioSwitch',a,b,c)
    updateTextBox()
    
def updateTextBox():
    global textBoxText, isRecursive, isRecursivedFolders
    resetTextBoxText()
    resetFilePaths()
    if isRecursive.get():
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