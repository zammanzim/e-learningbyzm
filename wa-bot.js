const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const P = require("pino");
const qrcode = require("qrcode-terminal");
const { Boom } = require("@hapi/boom");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.clear();
      console.log("📱 Scan QR berikut:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "connecting") {
      console.log("🔄 Connecting...");
    }

    if (connection === "open") {
      console.clear();
      console.log("✅ Bot berhasil login!");
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

      console.log("❌ Disconnect");
      console.log("Status:", statusCode);
      console.log(lastDisconnect);

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("🔁 Reconnecting...");
        startBot();
      } else {
        console.log("🚪 Session logout, hapus folder session lalu scan ulang.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;

    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (!text) return;

    console.log(`📩 ${from}: ${text}`);

    if (text === "/ping") {
      await sock.sendMessage(from, {
        text: "🏓 Pong!",
      });
      return;
    }

    if (text.startsWith("/echo ")) {
      await sock.sendMessage(from, {
        text: text.slice(6),
      });
      return;
    }

    await sock.sendMessage(from, {
      text: "kangen",
    });
  });
}

startBot();
