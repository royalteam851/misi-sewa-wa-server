process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true";

const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const sessions = {};

function cleanId(id) {
  return String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function createSession(userId) {
  userId = cleanId(userId);

  if (sessions[userId]) {
    return sessions[userId];
  }

  const session = {
    userId,
    client: null,
    qr: null,
    connected: false,
    status: "STARTING",
    number: null,
    error: null
  };

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--disable-gpu"
      ],
      defaultViewport: null,
      timeout: 180000
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    restartOnAuthFail: true
  });

  client.on("qr", async (qr) => {
    try {
      session.qr = await QRCode.toDataURL(qr);
      session.connected = false;
      session.status = "QR_READY";
      session.error = null;
      console.log("QR READY:", userId);
    } catch (err) {
      session.status = "QR_ERROR";
      session.error = err.message;
      console.log("QR ERROR:", userId, err.message);
    }
  });

  client.on("authenticated", () => {
    session.status = "AUTHENTICATED";
    session.error = null;
    console.log("AUTHENTICATED:", userId);
  });

  client.on("ready", () => {
    session.qr = null;
    session.connected = true;
    session.status = "CONNECTED";
    session.number = client.info?.wid?.user || null;
    session.error = null;
    console.log("CONNECTED:", userId, session.number);
  });

  client.on("auth_failure", (msg) => {
    session.connected = false;
    session.status = "AUTH_FAILURE";
    session.error = msg;
    console.log("AUTH FAILURE:", userId, msg);
  });

  client.on("disconnected", (reason) => {
    session.connected = false;
    session.status = "DISCONNECTED";
    session.error = reason;
    console.log("DISCONNECTED:", userId, reason);
  });

  session.client = client;
  sessions[userId] = session;

  setTimeout(() => {
    client.initialize().catch((err) => {
      session.connected = false;
      session.status = "ERROR";
      session.error = err.message;
      console.log("INIT ERROR:", userId, err.message);
    });
  }, 8000);

  return session;
}

app.get("/", (req, res) => {
  res.send("MISI SEWA WA ROYAL DREAM - WA SERVER AKTIF");
});

app.get("/qr/:userId", (req, res) => {
  const userId = cleanId(req.params.userId);
  const session = createSession(userId);

  res.json({
    status: true,
    userId,
    waStatus: session.status,
    connected: session.connected,
    number: session.number,
    qr: session.qr,
    error: session.error,
    message: session.connected
      ? "WhatsApp sudah terhubung"
      : session.qr
      ? "QR siap discan"
      : "QR sedang dibuat, klik ulang beberapa detik lagi"
  });
});

app.get("/status/:userId", (req, res) => {
  const userId = cleanId(req.params.userId);
  const session = sessions[userId];

  if (!session) {
    return res.json({
      status: true,
      userId,
      connected: false,
      waStatus: "NOT_STARTED",
      number: null,
      error: null
    });
  }

  res.json({
    status: true,
    userId,
    connected: session.connected,
    waStatus: session.status,
    number: session.number,
    error: session.error
  });
});

app.post("/send-message", async (req, res) => {
  try {
    const userId = cleanId(req.body.userId);
    const nomor = String(req.body.nomor || "").replace(/\D/g, "");
    const pesan = String(req.body.pesan || "");

    if (!userId || !nomor || !pesan) {
      return res.json({
        status: false,
        message: "userId, nomor, dan pesan wajib diisi"
      });
    }

    const session = sessions[userId];

    if (!session || !session.connected) {
      return res.json({
        status: false,
        message: "WhatsApp belum terhubung"
      });
    }

    await session.client.sendMessage(`${nomor}@c.us`, pesan);

    res.json({
      status: true,
      message: "Pesan berhasil dikirim",
      userId,
      nomor
    });

  } catch (err) {
    res.json({
      status: false,
      message: err.message
    });
  }
});

app.post("/logout/:userId", async (req, res) => {
  const userId = cleanId(req.params.userId);
  const session = sessions[userId];

  if (!session) {
    return res.json({
      status: true,
      message: "Session belum ada / sudah terhapus"
    });
  }

  try {
    try {
      await session.client.logout();
    } catch (e) {}

    try {
      await session.client.destroy();
    } catch (e) {}

    delete sessions[userId];

    res.json({
      status: true,
      message: "Session WA berhasil direset"
    });

  } catch (err) {
    delete sessions[userId];

    res.json({
      status: true,
      message: "Session dihapus paksa",
      error: err.message
    });
  }
});

app.get("/sessions", (req, res) => {
  const list = Object.keys(sessions).map(id => ({
    userId: id,
    connected: sessions[id].connected,
    status: sessions[id].status,
    number: sessions[id].number,
    error: sessions[id].error
  }));

  res.json({
    status: true,
    total: list.length,
    sessions: list
  });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
