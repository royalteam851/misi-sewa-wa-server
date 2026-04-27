const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// cek server hidup
app.get("/", (req, res) => {
  res.send("MISI SEWA WA ROYAL DREAM SERVER AKTIF");
});

// dummy QR dulu
app.get("/qr/:userId", (req, res) => {
  const userId = req.params.userId;

  res.json({
    status: true,
    userId,
    message: "QR dummy berhasil dibuat",
    qr: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=DEMO-WA-" + userId
  });
});

// dummy status WA
app.get("/status/:userId", (req, res) => {
  res.json({
    status: true,
    userId: req.params.userId,
    connected: true
  });
});

// dummy kirim pesan
app.post("/send-message", (req, res) => {
  const { userId, nomor, pesan } = req.body;

  res.json({
    status: true,
    userId,
    nomor,
    pesan,
    result: "Pesan dummy berhasil dikirim"
  });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});