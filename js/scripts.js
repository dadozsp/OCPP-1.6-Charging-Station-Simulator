var _ws = null;
var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
var id = randomId();
var connector_locked = false;
var firstMessage = true;
var reloadOnReset = false;
var msgBootNotification = JSON.stringify([2, id, "BootNotification", {
    "chargePointVendor": "Sinthesi Srl",
    "chargePointModel": "Testing Chargepoint",
    "chargePointSerialNumber": "sint.001.02.3",
    "chargeBoxSerialNumber": "sint.001.02.03.04",
    "firmwareVersion": "1.2.3",
    "iccid": "",
    "imsi": "",
    "meterType": "SIN TST-ACDC",
    "meterSerialNumber": "sint.001.13.1.01"
}]);
var msgHeartBeat = JSON.stringify([2, id, "Heartbeat", {}]);

function init() {
    $('select').formSelect();
    $('#connetti').text('Connect').css('background', '#FF5722');
}

function randomId() {
    id = "";

    for (var i = 0; i < 36; i++) {
        id += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return id;
}

function connectWs() {
    let url = $('#server_url').val();
    let cp = "OCPP-J1.6"

    if(_ws) {
        $('#stato').css('background-color','#D40000');
        _ws.close(3001);
    }
    else{
        _ws = new WebSocket(url + "", ["ocpp1.6", "ocpp1.5"]);

        _ws.onopen = () => {
            sessionStorage.setItem('LastAction', "BootNotification");
            $('#stato').css('background-color','#FFEB3B');
            
            logMsg("Socket opened");

            bootNotification();

            $('#connetti').text('Disconnect').css('background', '#4CAF50');
        };

        _ws.onmessage = (msg) => {handleReceivedMessages(msg);}

        _ws.onclose = (evt) => {
            $('#stato').css('background-color','#FF5722');

            $('#connetti').text('Connect').css('background', '#FF5722');
           
            if (evt.code == 3001) {
                logMsg("Socket closed");
                _ws = null;
            } else {
                logMsg('Error while closing the socket: ' + evt.code);
                _ws = null;
            }

            firstMessage = true;
        }
    }
}

function handleReceivedMessages(msg) {
    let jMsg = (JSON.parse(msg.data));

    if(firstMessage) {
        let hb_interval = handleData(jMsg);

        sessionStorage.setItem("Configuration",hb_interval);
        startHB(hb_interval*1000);
        firstMessage = false;
    }

    if(jMsg[0] === 3) {
        la = getLastAction();

        if (la == "startTransaction") {
            let dd = jMsg[2];
            let array = $.map(dd, function (value, index) {
                return [value];
            });
            let TransactionId = (array[1]);

            logMsg("Transaction created");
            
            sessionStorage.setItem('TransactionId', TransactionId);
        }

        logMsg("Data: " + JSON.stringify(jMsg[2]));
    }
    else if((JSON.parse(msg.data))[0] === 4) {
        logMsg("Error: Invalid response format");
        logMsg("Data: " + JSON.stringify(msg.data))
    }
    else if((JSON.parse(msg.data))[0] === 2) {
        id = (JSON.parse(msg.data))[1];

        switch(jMsg[2]) {
            case "Reset":
                let resetR = JSON.stringify([3, id, {"status": "Accepted"}]);

                _ws.send(resetR);

                logMsg("Received reset request");
                logMsg("Data: " + JSON.stringify(msg.data));

                if(reloadOnReset) {
                    document.location.reload();
                }

                break;

            case "UnlockConnector":
                let UC = JSON.stringify([3, id, {"status": "Unlocked"}]);

                _ws.send(UC);

                connector_locked = false;

                logMsg("Connector status updated: " + (connector_locked ? "LOCKED" : "UNLOCKED"));
                logMsg("Data: " + JSON.stringify(msg.data));

                $('#stato').css('background-color','#FFEB3B');
                break;

            case "RemoteStartTransaction":
                let remStrt = JSON.stringify([3, id, {"status": "Accepted"}]);

                _ws.send(remStrt);

                logMsg("Received a remote transaction start");
                logMsg("Data: " + JSON.stringify(msg.data));

                startTransaction();
                break;

            case "RemoteStopTransaction":
                let remStp = JSON.stringify([3, id, {"status": "Accepted"}]);
                let stop_id = (JSON.parse(msg.data)[3].transactionId);
                
                _ws.send(remStp);
                logMsg("Received a remote transaction stop");
                stopTransaction(stop_id);
                logMsg("Data: " + JSON.stringify(msg.data));

                $('#stato').css('background-color','#FFEB3B');

                break;

            case "ReserveNow":
                let rsrv = JSON.stringify([3,id,{"status":"Accepted"}]);

                _ws.send(rsrv);

                logMsg("Received a reservation request")
                logMsg("Data: " + JSON.stringify(msg.data));
                break;

            case "CancelReservation":
                let cancRes = JSON.stringify([3,id,{"status":"Accepted"}]);

                _ws.send(cancRes);

                logMsg("Received a cancellaion request for a reservation")
                logMsg("Data: " + JSON.stringify(msg.data));
                break;

            case "SetChargingProfile":
                let setPro = JSON.stringify([3,id,{"status":"Accepted"}]);

                _ws.send(setPro);

                logMsg("Received charging profile")
                logMsg("Data: " + JSON.stringify(msg.data));
                break;
            
            default:
                logMsg("Unknown or unsupported command")  

        }
    }
}

function handleData(data, request = false){

    let lastAction = getLastAction();

    if(lastAction = "BootNotification"){
        data = data[2];
        heartbeat_interval = data.interval;
        logMsg("Data: " + JSON.stringify(data));
        return heartbeat_interval;
    }else if(lastAction = "StartTransaction"){
        return "StartTransaction";
    }
}

function bootNotification() {
    logMsg('BootNotification sent');
    _ws.send(msgBootNotification);
}

function heartbeat() {
    logMsg("Inviato Heartbeat");
    sessionStorage.setItem('LastAction', "Heartbeat");
    _ws.send(msgHeartBeat);
}

function startTransaction(){
    sessionStorage.setItem('LastAction', "startTransaction");

    connector_locked = true;

    logMsg("Connector status updated: " + (connector_locked ? "LOCKED" : "UNLOCKED"));

    let strtT = JSON.stringify([2, id, "StartTransaction", {
        "connectorId": $('#connector_id').val(),
        "idTag": $("#tag_id").val(),
        "timestamp": formatDate(new Date()),
        "meterStart": 0,
        "reservationId": 0
    }]);

    _ws.send(strtT);

    logMsg("Transaction started");

    $('#stato').css('background-color','#4CAF50 ');
}

function stopTransaction(transaction_id = false){
    sessionStorage.setItem('LastAction', "stopTransaction");

    transaction_id == false ? ssid = sessionStorage.getItem('TransactionId') : ssid = transaction_id;
    connector_locked = false;

    logMsg("Connector status updated: " + (connector_locked ? "LOCKED" : "UNLOCKED"));

    let stpT = JSON.stringify([2, id, "StopTransaction",{
        "transactionId": ssid,
        "idTag": $("#tag_id").val(),
        "timestamp": formatDate(new Date()),
        "meterStop": parseInt($('#tmeter_end').val()),
        "reason":$('#tstop_reason').val()
    }]);

    _ws.send(stpT);

    logMsg("Transaction stopped");

    $('#stato').css('background-color','#FFEB3B');
}

function authorize(){
    sessionStorage.setItem('LastAction', "Authorize");

    let Auth = JSON.stringify([2, id, "Authorize", {"idTag": $("#tag_id").val()}]);

    _ws.send(Auth);
}

function sendMeterValue() {
    sessionStorage.setItem('LastAction', "MeterValues");
    ssid = sessionStorage.getItem('TransactionId');

    let val = $("#metervalue").val();
    let MV = JSON.stringify([2, id, "MeterValues", {"connectorId": $('#connector_id').val(), "transactionId": ssid, "meterValue": [{"timestamp": formatDate(new Date()), "sampledValue": [{"value": val, "measurand": "Energy.Active.Import.Register"},{"value": 800, "measurand": "Power.Active.Import"},{"value": 47, "measurand": "SoC"}]}]}]);
    
    _ws.send(MV);

    logMsg("MeterValue sent");
}

function statusNotification() {
    sessionStorage.setItem('LastAction', "StatusNotification");

    let SN = JSON.stringify([2, id, "StatusNotification", {
        "connectorId": $('#connector_id').val(),
        "status": $('#status_notif').val(),
        "errorCode": "NoError",
        "info": "",
        "timestamp": formatDate(new Date()),
        "vendorId": "",
        "vendorErrorCode": ""
    }]);

    _ws.send(SN);

    logMsg("Status sent: " + $('#status_notif').val());
}

function startHB(interval) {
    logMsg("Setting heartbeat interval to " + interval);
    setInterval(() => {heartbeat;},interval);
}

function getLastAction(){
    var LastAction = sessionStorage.getItem("LastAction");
    return LastAction;
}

function logMsg(msg) {
    $('#log').append('<li> ->' + msg + ' </li>');
}

function formatDate(date) {
    let day = String(date.getUTCDate());
    if (day.length <2){
        day = ('0' + day.slice(-2));
    }

    let monthIndex = String(date.getUTCMonth()+1);
    if (monthIndex.length <2){
        monthIndex = ('0' + monthIndex.slice(-2));
    }
    let year = date.getUTCFullYear();
    let h = String(date.getUTCHours());
    let m = String(date.getUTCMinutes());
    let s = String(date.getUTCSeconds());


    if (h.length <2){
        h = ('0' + h.slice(-2));
    }
    if (m.length <2){
        m = ('0' + m.slice(-2));
    }
    if (s.length <2){
        s = ('0' + s.slice(-2));
    }
    return year + '-' + monthIndex + '-' + day+"T"+h+":"+m+":"+s+"Z";
}

