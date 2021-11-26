import { readFileSync } from "fs";
import { createServer as createServerHTTPS } from 'https';
import { createServer as createServerHTTP } from 'http';
import { Server } from "socket.io";
import { v4 as uuidv4 } from 'uuid';

const ShitDataStorageSolution = {
    ioClients: {},
    ioDocuments: {},
    ioOTKeys: {},
    ForwardedEvents: ["SharedStateRelay-DSMG-ioComm"],
}

function createHttpsServerOpts() {
    if (process.env.isProduction) {
        return {}
    } else {
        return {
            key: readFileSync("C:/Certs/ssc/LocalServer_Cert1/create-cert-key.pem"),
            cert: readFileSync("C:/Certs/ssc/LocalServer_Cert1/create-cert.pem")
        }
    }
}
function createHttpServer() {
    if (process.env.isProduction) {
        return createServerHTTP({}, (req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            switch (req.url) {
                case '/collab/server/info':
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        servertime: new Date().getTime(),
                        status: 200,
                        version: "1.0.0",
                        socketAddr: '/socket',
                        security: 'none'
                    }));
                    break;
                default:
                    res.writeHead(404);
                    res.end();
                    break;
            }
        });
    } else {
        return createServerHTTPS({
            key: readFileSync("C:/Certs/ssc/LocalServer_Cert1/create-cert-key.pem"),
            cert: readFileSync("C:/Certs/ssc/LocalServer_Cert1/create-cert.pem")
        }, (req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            switch (req.url) {
                case '/collab/server/info':
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        servertime: new Date().getTime(),
                        status: 200,
                        version: "1.20.0",
                        socketAddr: '/socket',
                        security: 'none'
                    }));
                    break;
                default:
                    res.writeHead(404);
                    res.end();
                    break;
            }
        });
    }
}

const httpServer = createHttpServer();

const io = new Server(httpServer, {
    path: "/socket",
    serveClient: false,
    cors: {
        origin: ["https://stride-frontend.vercel.app", "https://localhost:1673", "https://192.168.86.50:1673"],
    }
});

io.engine.generateId = (req) => {
    return uuidv4();
}

io.on("connection", (socket) => {
    console.log(socket.id + ' has joined.');
    socket.on('SharedStateRelay-DSMG-ioComm', (docID, name, args) => {
        console.log('Recieved Event from ' + ShitDataStorageSolution.ioClients[socket.id].rProfileID + ': ' + docID + ' ' + name + ' ' + args);
        io.to(ShitDataStorageSolution.ioClients[socket.id]).emit('SharedStateRelay-DSMG-ioComm', name, args);
    });
});

io.of(/(.*?)/).on("connection", (socket) => {
    console.log(socket.id + ' has joined.');
    socket.data.userProfile = socket.handshake.query.userprofile;
    let up = socket.data.userProfile;
    socket.nsp.emit('SharedStateRelay-DSMG-ioConnectivity-NewUser', JSON.parse(socket.handshake.query.userprofile));

    socket.on("SharedStateRelay-DSMG-ioConnectivityCheck", (callback) => {
        socket.nsp.emit('SharedStateRelay-DSMG-ioDocumentStateUpdateGet')
        socket.nsp.fetchSockets().then((sockets) => {
            const intl = {
                currentUsers: []
            }
            sockets.forEach(socket => {
                intl.currentUsers.push(JSON.parse(socket.data.userProfile));
            })
            callback(intl);
        });
    });
    socket.on("disconnect", () => {
        console.log("disconnected", socket)
        socket.nsp.fetchSockets().then((sockets) => {
            const intl = {
                currentUsers: []
            }
            sockets.forEach(socket => {
                intl.currentUsers.push(JSON.parse(socket.data.userProfile));
            })
            socket.nsp.emit('SharedStateRelay-DSMG-ioConnectivity-RemoveUser', JSON.parse(up), intl);
        });
    });

    socket.on('SharedStateRelay-DSMG-ioDocumentStateUpdate', (documentState) => {
        console.log('got documentState')
        socket.nsp.emit('SharedStateRelay-DSMG-ioDocumentStateUpdate', documentState)
    });

    socket.on('SharedStateRelay-DSMG-ioComm', (name, args) => {
        socket.nsp.emit('SharedStateRelay-DSMG-ioComm', name, args);
    });

    socket.on('SharedStateRelay-DSMG-ioComm', (name, args) => {
        socket.nsp.emit('SharedStateRelay-DSMG-ioComm', name, args);
    });

    socket.on("disconnecting", (reason) => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.to(room).emit("user has left", socket.id);
            }
        }
    });
});

httpServer.listen(process.env.PORT || 1674);
console.log("Server started on port " + process.env.PORT || 1674);


