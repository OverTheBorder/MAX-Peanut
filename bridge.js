const net = require('net');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8081 });

console.log("WebSock is listening on port 8081");

wss.on('connection', (ws) => {

    let currentSequence = 0; 

    console.log('Frontend client connected via Websock.')

    const aimSocket = new net.Socket();

    aimSocket.connect(5190, 'IP ADD HERE', () => {
        console.log('Connected to AIM Server via TCP')
    });

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log("Received from Frontend:", data);
    });

    aimSocket.on('data', (data) =>{
        console.log('Received raw data from AIM:', data);
        ws.send(JSON.stringify({rawBytesLength: data.length}));

        if (data.length >= 6) {

            const StartMarker = data.readUInt8(0); //read the first hex
            const chanel = data.readUInt8(1); //chanel type okay. 
            const sequence = data.readUInt16BE(2);
            const payLoadlen = data.readUInt16BE(4); 

            if (StartMarker === 0x2A) {
                console.log('[FLAP IN] Ch: ' + chanel + ' | Seq: ' + sequence + ' | Payload Len: ' + payLoadlen);

                if (chanel === 1) {
                    console.log('HEY THIS OUR GUY! LET EM IN!');

                    const clientHandshake = Buffer.alloc(10);
                    
                    clientHandshake.writeUInt8(0x2A, 0);
                    clientHandshake.writeUInt8(0x01, 1);
                    clientHandshake.writeUInt16BE(currentSequence, 2);
                    clientHandshake.writeUInt16BE(4, 4);


                    clientHandshake.writeUInt32BE(1, 6);

                    aimSocket.write(clientHandshake);

                    currentSequence = (currentSequence + 1) % 65536;
                };
            } else {
                console.log("HEYO WTH IS THIS SHI");
            };
        };
    });

    ws.on('close', () =>{
        console.log("Frontend client disconnected.");
        aimSocket.destroy();
    });

    aimSocket.on('close', () => {
        console.log('AIM Server connection closed.');
        ws.close();
    });

    aimSocket.on('error', (err) =>{
        console.error("AIM FUCKED:", err);
    });
});


