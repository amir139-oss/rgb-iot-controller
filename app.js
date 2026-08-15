const CONFIG={
  host:"090dc724cffd407b9a8e3eca177cf993.s1.eu.hivemq.cloud",
  port:8884,
  command:"amir/light/command",
  status:"amir/light/status",
  online:"amir/light/online"
};

const COLORS=[
  {name:"قرمز",rgb:[255,0,0],css:"#ff0000"},
  {name:"سبز",rgb:[0,255,0],css:"#00ff00"},
  {name:"آبی",rgb:[0,0,255],css:"#0000ff"},
  {name:"زرد",rgb:[255,255,0],css:"#ffff00"},
  {name:"بنفش",rgb:[255,0,255],css:"#ff00ff"},
  {name:"فیروزه‌ای",rgb:[0,255,255],css:"#00ffff"},
  {name:"سفید",rgb:[255,255,255],css:"#fff"}
];
const BR=[0,25,50,75,100];
let client=null;

const $=id=>document.getElementById(id);

function log(s){
  const b=$("log");
  b.textContent=`[${new Date().toLocaleTimeString("fa-IR")}] ${s}\n${b.textContent}`.slice(0,12000);
}
function state(s,t){
  const b=$("connectionBadge");
  b.classList.remove("connected","connecting");
  if(s==="connected")b.classList.add("connected");
  if(s==="connecting")b.classList.add("connecting");
  $("connectionText").textContent=t;
  $("mqttState").textContent=t;
  $("connectBtn").disabled=s==="connected"||s==="connecting";
  $("disconnectBtn").disabled=s!=="connected";
}
function connectMQTT(){
  if(typeof mqtt==="undefined"){log("MQTT.js بارگذاری نشده است.");return}
  const host=$("host").value.trim(),port=Number($("port").value);
  const user=$("username").value.trim(),pass=$("password").value;
  if(!host||!Number.isInteger(port)||port<1||port>65535){alert("Host/Port را درست وارد کن.");return}
  if(!user||!pass){alert("Username و Password HiveMQ را وارد کن.");return}
  if(client){try{client.end(true)}catch(e){}}
  const url=`wss://${host}:${port}/mqtt`;
  state("connecting","در حال اتصال...");
  log(`Connecting: ${url}`);
  client=mqtt.connect(url,{
    clientId:`web-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    username:user,password:pass,protocolVersion:5,clean:true,
    reconnectPeriod:3000,connectTimeout:10000,keepalive:30
  });
  client.on("connect",()=>{
    state("connected","متصل");log("MQTT connected.");
    client.subscribe(CONFIG.status,{qos:0},e=>log(e?`Subscribe error: ${e.message}`:`Subscribed: ${CONFIG.status}`));
    client.subscribe(CONFIG.online,{qos:0},e=>log(e?`Subscribe error: ${e.message}`:`Subscribed: ${CONFIG.online}`));
    client.publish(CONFIG.status,"STATUS",{qos:0});
  });
  client.on("message",(topic,payload)=>{
    const text=payload.toString();
    if(topic===CONFIG.status)showStatus(text);
    if(topic===CONFIG.online){log(`Device: ${text}`);if(text==="offline")$("deviceState").textContent="OFFLINE"}
  });
  client.on("error",e=>{log(`MQTT error: ${e.message||e}`);state("disconnected","خطا")});
  client.on("close",()=>{log("MQTT connection closed.");state("disconnected","قطع")});
  client.on("reconnect",()=>state("connecting","اتصال مجدد..."));
  client.on("offline",()=>state("disconnected","آفلاین"));
}
function disconnectMQTT(){
  if(client){try{client.end(true)}catch(e){}client=null}
  state("disconnected","قطع");log("Disconnected.");
}
function send(cmd){
  if(!client||!client.connected){alert("ابتدا به HiveMQ متصل شو.");return}
  client.publish(CONFIG.command,cmd,{qos:0,retain:false},e=>{
    if(e)log(`Publish error: ${e.message}`);else log(`→ ${CONFIG.command}: ${cmd}`);
  });
}
function clamp(v,a,b){return Math.min(Math.max(v,a),b)}
function showStatus(text){
  try{
    const d=JSON.parse(text);
    $("deviceState").textContent=d.online?"ONLINE":"OFFLINE";
    $("modeText").textContent=d.manual?"MANUAL":"AUTO";
    const ci=clamp(Number(d.color)||0,0,COLORS.length-1),c=COLORS[ci];
    $("colorText").textContent=c.name;
    $("selectedColorDot").style.background=c.css;
    document.querySelectorAll(".color").forEach(x=>x.classList.toggle("active",Number(x.dataset.color)===ci));

    const bi=clamp(Number(d.brightnessIndex)||0,0,4);
    $("brightnessSlider").value=bi;
    $("brightnessValue").textContent=`${BR[bi]}%`;

    const ldr=clamp(Number(d.ldr)||0,0,100);
    $("ldrValue").textContent=ldr;
    $("ldrProgress").style.width=`${ldr}%`;
    $("ldrPill").textContent=ldr>=55?"روشن":ldr<=45?"تاریک":"میانه";

    const motion=Number(d.pir)===1;
    $("pirValue").textContent=motion?"MOTION":"NONE";
    $("pirPill").textContent=motion?"حرکت":"بدون حرکت";

    const rssi=Number(d.wifiRssi);
    $("rssiValue").textContent=Number.isFinite(rssi)?`${rssi} dBm`:"—";
    $("wifiPill").textContent=Number.isFinite(rssi)?quality(rssi):"—";

    $("uptimeValue").textContent=uptime(Number(d.uptime)||0);
    $("lastUpdate").textContent=`آخرین بروزرسانی: ${new Date().toLocaleTimeString("fa-IR")}`;
    preview(c,Number(d.brightness)||0,Boolean(d.rainbow));
  }catch(e){log(`Status JSON error: ${e.message}`)}
}
function preview(c,raw,rainbow){
  const box=$("lightPreview"),core=box.querySelector(".core");
  if(rainbow){
    box.style.background="conic-gradient(#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)";
    core.style.background="#fff";core.style.boxShadow="0 0 40px #fff";
    return
  }
  const a=clamp(raw/1023,0,1);
  const col=`rgba(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]},${Math.max(.12,a)})`;
  box.style.background=`radial-gradient(circle,${col},rgba(255,255,255,.02) 68%)`;
  core.style.background=col;
  core.style.boxShadow=`0 0 ${20+a*55}px ${col}`;
}
function quality(r){return r>=-55?"عالی":r>=-67?"خوب":r>=-75?"متوسط":"ضعیف"}
function uptime(s){
  const d=Math.floor(s/86400);s%=86400;
  const h=Math.floor(s/3600);s%=3600;
  const m=Math.floor(s/60),sec=Math.floor(s%60);
  if(d)return `${d} روز ${h} ساعت`;
  if(h)return `${h} ساعت ${m} دقیقه`;
  if(m)return `${m} دقیقه ${sec} ثانیه`;
  return `${sec} ثانیه`;
}

$("connectBtn").onclick=connectMQTT;
$("disconnectBtn").onclick=disconnectMQTT;
document.querySelectorAll("[data-command]").forEach(b=>b.onclick=()=>send(b.dataset.command));
document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>send(`COLOR:${b.dataset.color}`));
$("brightnessSlider").onchange=e=>send(`BRIGHTNESS:${e.target.value}`);
$("clearLogBtn").onclick=()=>{$("log").textContent=""};
["username","password"].forEach(id=>$(id).onkeydown=e=>{if(e.key==="Enter")connectMQTT()});
state("disconnected","قطع");
log("صفحه آماده است. Username/Password HiveMQ را وارد کن.");
