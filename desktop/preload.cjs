'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
 minimize:()=>ipcRenderer.send('window:minimize'),
 maximize:()=>ipcRenderer.send('window:maximize'),
 close:()=>ipcRenderer.send('window:close'),
 finishClose:()=>ipcRenderer.send('window:close-ready'),
 onBeforeClose:callback=>{ipcRenderer.on('window:before-close',()=>callback());},
 onMaximized:callback=>{ipcRenderer.on('window:maximized',(_event,value)=>callback(value));},
});
