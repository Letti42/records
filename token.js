
const puppeteer = require('puppeteer');
const WebSocket = require('ws').WebSocket;
const getToken = require('./auth').getToken;
const express = require('express');
const app = express();
const db = require('quick.db');
//reset 
db.set('active',{activeIds:[]});
var CronJob = require('cron').CronJob;

var job = new CronJob('0 0 */12 * * *', function() {
    for(var i =0; i<db.get('active').activeIds.length;i++){
      db.delete(db.get('active').activeIds[i]);
    }
    db.set('active',{activeIds:[]});
  },
  null,
  true,
  'America/New_York'
);
job.start();


app.get('/',(req,res)=>{
  if((req.query.url === undefined && req.query.id === undefined)||(req.query.url && req.query.id))return res.status(200).send({bad:'Undefined URL or too many Queries'});
  if(req.query.id){
    console.log('Getting Database...');
    db.get(req.query.id.toString()) == null? res.status(200).send({bad:"Still working on records",id:req.query.id}):res.status(200).send({good:true,data:db.get(req.query.id.toString())});
    console.log(req.query.id.toString());
    console.log(req.query.id.toString() == null);
  }
  if(req.query.url){
    let reqId = Math.floor(Math.random()*100000);
    console.log("New ID: "+reqId)
    res.status(200).send({good:"ok ur not stupid dum dum",id:reqId});
    start(req.query.url, reqId)
  }
});



  async function start(req_url,req_id){
  console.log('Starting...')
  req_id = req_id.toString();
  var id = req_url.split('applab/')[1].split('/')[0];
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`https://studio.code.org/projects/applab/${id}/view`,{
    waitUntil:"networkidle2"
  });
  await page.waitForTimeout(1000);
  let records = [], tables = [];
  await page.exposeFunction('pushTable',(arr,data)=>{
    tables.push({name:JSON.parse(data).name,arr});
    if(JSON.parse(data).i == JSON.parse(data).keys - 1)sendD({records:tables},req_id);
    if(JSON.parse(data).i == JSON.parse(data).keys - 1)browser.close();
  })
  var url = await page.evaluate(()=>localStorage.getItem('firebase:host:cdo-v3-prod.firebaseio.com'));
  getToken(id).then((r)=>{return r.text();}).then((d)=>{
    let token = d.split("firebaseAuthToken\":\"")[1].substring(0,d.split("firebaseAuthToken\":\"")[1].indexOf('"'));
    var socket = new WebSocket(`wss://${url.replace('"','').replace('"','')}/.ws?v=5&ns=cdo-v3-prod`);
    socket.onerror = (err)=>{
      console.log(err);
    }
    socket.onopen = ()=>{
      socket.onmessage = (msg)=>{
        if(msg.data.includes('counters/tables')){
          records.push(JSON.parse(msg.data).d.b.d);
          for(var i =0; i < Object.keys(records[0]).length; i++){
            var data = JSON.stringify({name:Object.keys(records[0])[i],keys:Object.keys(records[0]).length,i:i});
            ;(async()=>{
              await page.evaluate((d)=>{
                Applab.storage.readRecords(JSON.parse(d).name,{},function(f){
                  pushTable(f,d);
                });
            },data);
            })();
          }
        }
      };
      socket.send(JSON.stringify({"t":"d","d":{"r":44,"a":"auth","b":{"cred":token}}}));
      socket.send(JSON.stringify({"t":"d","d":{"r":45,"a":"q","b":{"p":`/v3/channels/${id}/counters/tables`,"h":""}}}));
    };
  });
}

function sendD(records,id){
  db.set(id,records);
  console.log('done!');
  var active = db.get('active').activeIds;
  active.push(id);
  db.set('active', {activeIds:active});
  console.log('Sent Data!');
}

app.listen(process.env.PORT || 3000);


