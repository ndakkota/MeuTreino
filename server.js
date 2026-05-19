const webpush = require("web-push");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const publicKey = "BHdPeoX4M0amsOq3Ue84nMIc06xo-QlDc6HxW6g2fzfuYOQIBUoeojrhYzuFGv8XlWKstyiN7IXRpK2KL2bv2Yk";
const privateKey = "oCfu7Rz7LCmEzPJ480jTLT0CEgV_Pua35gNTbH0Aqhc";

webpush.setVapidDetails("suelleny.tsouza@gmail.com", publicKey, privateKey);

const users = {}; // { userId: { lastAccess, subscription } }

app.post("/subscribe", (req, res) => {
  const { userId, subscription } = req.body;
  if (!users[userId]) users[userId] = {};
  users[userId].subscription = subscription;
  res.status(201).json({});
});

app.post("/updateAccess", (req, res) => {
  const { userId } = req.body;
  if (!users[userId]) users[userId] = {};
  users[userId].lastAccess = Date.now();
  res.json({ message: "Último acesso atualizado" });
});

function checkInactivity() {
  const now = Date.now();
  Object.keys(users).forEach(userId => {
    const user = users[userId];
    if (user.lastAccess) {
      const diffDays = Math.floor((now - user.lastAccess) / (1000 * 60 * 60 * 24));
      if (diffDays >= 2 && user.subscription) {
        const payload = JSON.stringify({
          title: "PowerFit",
          body: "⚠️ Você está há 2 dias sem treinar!"
        });
        webpush.sendNotification(user.subscription, payload).catch(err => console.error(err));
      }
    }
  });
}

// Checa a cada 24h
setInterval(checkInactivity, 24 * 60 * 60 * 1000);

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
