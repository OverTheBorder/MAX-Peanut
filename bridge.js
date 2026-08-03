const crypto = require("crypto")
const { connect } = require('http2');
const net = require('net');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8081 });

console.log("WebSock is listening on port 8081");

wss.on('connection', (ws) => {

    let currentSequence = 0; 
    
    let receiveBuffer = Buffer.alloc(0);

    var pendingAuth = [];

    console.log('Frontend client connected via Websock.')

    const aimSocket = new net.Socket();

    aimSocket.connect(5190, 'overtheworld.duckdns.org', () => {
        console.log('Connected to AIM Server via TCP')
    });

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log("Received from Frontend:", data);

        if (data.action === "connect") {
            const username = data.username;

            pendingAuth.username = data.username;
            pendingAuth.password = data.password;

            console.log("Building AUTH Request from: " + username);

            const userHandshake = Buffer.alloc(6 + 10 + 4 + username.length);

            userHandshake.writeUInt8(0x2A, 0);
            userHandshake.writeUInt8(0x02, 1);
            userHandshake.writeUInt16BE(currentSequence, 2);
            userHandshake.writeUInt16BE(10 + 4 + username.length, 4);

            //SNAC
            userHandshake.writeUInt16BE(0x0017, 6);
            userHandshake.writeUInt16BE(0x0006, 8);
            userHandshake.writeUInt16BE(0x0000, 10);
            userHandshake.writeUInt32BE(1, 12);

            //TLV
            userHandshake.writeUInt16BE(0x0001, 16);
            userHandshake.writeUInt16BE(username.length, 18);
            userHandshake.write(username, 20, 'ascii');

            //Sending user data. 
            aimSocket.write(userHandshake);

            currentSequence = (currentSequence + 1) % 65536;
        };
    });


    //Data transformation. 
    aimSocket.on('data', (data) =>{
        
        console.log('Received raw data from AIM:', data);
        ws.send(JSON.stringify({rawBytesLength: data.length}));

        receiveBuffer = Buffer.concat([receiveBuffer, data]);
        
        console.log(receiveBuffer);

        while (receiveBuffer.length >= 6) {
            const payLoadlen = receiveBuffer.readUInt16BE(4); 

            const totalPacketSize = payLoadlen + 6;

            let currentPacket = 0;

            if (receiveBuffer.length < totalPacketSize) {
                break;
            } else {
                currentPacket = receiveBuffer.subarray(0, totalPacketSize);
                receiveBuffer = receiveBuffer.subarray(totalPacketSize);
            };

            const StartMarker = currentPacket.readUInt8(0); //read the first byte.
            const chanel = currentPacket.readUInt8(1); //chanel type okay. 
            const sequence = currentPacket.readUInt16BE(2);

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
                //Password check
                } else if (chanel === 2) { 
                    console.log("Still our guy.")
                    const snacFamily  = currentPacket.readUInt16BE(6);
                    const snacSubtype = currentPacket.readUInt16BE(8);

                    if (snacFamily === 0x0017 && snacSubtype === 0x0007) {
                        console.log("Received the Auth key response.")

                        const keyLen = currentPacket.readUInt16BE(16);
                        const authKey = currentPacket.subarray(18, 18 + keyLen).toString('ascii');

                        console.log("AUTH KEY:", authKey, " (length:", keyLen, ")");

                        const pwHash = crypto.createHash("md5").update(pendingAuth.password).digest();
                        const finalHash = crypto.createHash('md5').update(Buffer.concat([Buffer.from(authKey, 'ascii'), pwHash])).digest();

                        //BUild TLVs
                            const snTlv = Buffer.concat([
                                Buffer.from([0x00, 0x01]),
                                Buffer.from([0x00, pendingAuth.username.length]),
                                Buffer.from(pendingAuth.username, 'ascii')
                            ]);

                            const pwTlv = Buffer.concat([
                                Buffer.from([0x00, 0x02]),
                                Buffer.from([0x00, finalHash.length]),
                                finalHash
                            ]);

                            const snacHeader = Buffer.alloc(10);
                            snacHeader.writeUInt16BE(0x0017, 0);
                            snacHeader.writeUInt16BE(0x002, 2);
                            snacHeader.writeUInt16BE(0x0000, 4);
                            snacHeader.writeUInt32BE(0x00000001, 6);

                            const snacPayload = Buffer.concat([snacHeader, snTlv, pwTlv]);

                            const flapHeader = Buffer.alloc(6);
                            flapHeader.writeUInt8(0x2A, 0);
                            flapHeader.writeUInt8(0x02, 1);
                            flapHeader.writeUInt16BE(currentSequence, 2);
                            flapHeader.writeUInt16BE(snacPayload.length, 4);
                            currentSequence = (currentSequence + 1) % 65536;

                            aimSocket.write(Buffer.concat([flapHeader, snacPayload]));
                            console.log("SENT LOGIN REQUEST");
                            };
                        };
    
                } else if (chanel === 4) {
                    console.log('Almost done...')
                } else {
                    console.log("GET OUT");
                    break;
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




