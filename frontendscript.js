const ws = new WebSocket('ws://overtheworld.duckdns.org:8081');

ws.onopen = () => {
    console.log('Connected to the Bridge!');
};

document.getElementById("loginBtn").addEventListener('click', () => {

    const userText = document.getElementById("nameInput").value;
    const passText = document.getElementById("passwordInput").value;

    ws.send(JSON.stringify({
        action: "connect",
        username: userText,
        password: passText
    }));

    console.log("Sent login request for: " + userText);
});

ws.onmessage = (event) => {
        // Log whatever JSON the bridge sends back from the AIM server            
console.log('Message from Bridge:', JSON.parse(event.data));
};