'use strict';
const {app,BrowserWindow,Menu,ipcMain}=require('electron');
const path=require('node:path');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let window,closing=false,closeAllowed=false,closeTimeout;
function requestClose(){
 if(closing)return;closing=true;
 if(!window||window.isDestroyed())return app.quit();
 window.webContents.send('window:before-close');
 // Still close if a crashed renderer cannot acknowledge its exit effect.
 closeTimeout=setTimeout(()=>{closeAllowed=true;window?.destroy();app.quit();},1500);
}
function createWindow(){
 closing=false;closeAllowed=false;
 window=new BrowserWindow({width:1366,height:768,minWidth:683,minHeight:384,useContentSize:true,
  title:'PLASMATIO',frame:false,backgroundColor:'#000000',autoHideMenuBar:true,show:false,
  webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true},
 });
 window.loadFile(path.join(__dirname,'..','index.html'));
 window.once('ready-to-show',()=>window.show());
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',event=>event.preventDefault());
 window.on('maximize',()=>window.webContents.send('window:maximized',true));
 window.on('unmaximize',()=>window.webContents.send('window:maximized',false));
 window.on('close',event=>{if(!closeAllowed){event.preventDefault();requestClose();}});
 window.webContents.on('before-input-event',(event,input)=>{
  if(input.type!=='keyDown')return;
  if(input.key==='F11'){event.preventDefault();window.setFullScreen(!window.isFullScreen());}
  if((input.control||input.meta)&&input.key.toLowerCase()==='q'){event.preventDefault();requestClose();}
  if((input.control||input.meta)&&input.key.toLowerCase()==='m')window.minimize();
 });
}
function fromWindow(event){return window&&!window.isDestroyed()&&event.sender===window.webContents;}
ipcMain.on('window:minimize',event=>{if(fromWindow(event))window.minimize();});
ipcMain.on('window:maximize',event=>{if(fromWindow(event)){if(window.isMaximized())window.unmaximize();else window.maximize();}});
ipcMain.on('window:close',event=>{if(fromWindow(event))requestClose();});
ipcMain.on('window:close-ready',event=>{if(fromWindow(event)&&closing){clearTimeout(closeTimeout);closeAllowed=true;window.close();app.quit();}});
app.whenReady().then(()=>{Menu.setApplicationMenu(null);createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('before-quit',event=>{if(window&&!window.isDestroyed()&&!closeAllowed){event.preventDefault();requestClose();}});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
