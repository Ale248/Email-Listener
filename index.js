require("dotenv").config();
const Imap = require("imap");
const simpleParser = require("mailparser").simpleParser;
const inspect = require("util").inspect;
const MailParser = require("mailparser").MailParser;

var imap = new Imap({
  user: `${process.env.EMAIL_USER}`,
  password: `${process.env.EMAIL_PASS}`,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false,
  },
});

function openInbox(cb) {
  // has to be false to mark as read (read_only property)
  imap.openBox("INBOX", false, cb);
}

var emailDB = ["hadesstark8@gmail.com"];
var transactions = [];
var seqnos = [];
var messageCount = 0;
let allProcessesDone;
const waitForAllProcesses = new Promise(
  (resolve, reject) => (allProcessesDone = resolve)
);

// fill transactions array with info from UNREAD emails from inbox
// transactions[i] = {
//   user: "",
//   code: "",
//   marketplace: "",
// };
imap.once("ready", () => {
  openInbox((err, box) => {
    if (err) throw err;
    console.log(box.messages.total + " message(s) found!");
    // search current box (inbox) for unread messages
    // use seqno here instead of uid
    // seqno is relative to the box, uid is unique for every email
    imap.seq.search(["UNSEEN"], (err, results) => {
      console.log(results);
      if (err) throw err;
      if (results.length === 0) {
        // if all emails are read
        console.log("No unread emails");
        imap.end();
        return;
      }
      var f = imap.seq.fetch(results, {
        bodies: "",
      });
      f.on("message", (msg, seqno) => {
        console.log("Message #%d", seqno);
        var prefix = "(#" + seqno + ") ";
        msg.once("body", (stream, info) => {
          simpleParser(stream, (err, mail) => {
            if (err) throw err;
            // call helper function
            // if true, then mark
            // true is when email matches database, and no error when parsing
            // mark = processEmail(mail, seqno);
            // wait until current process is finished
            let mark = processEmail(mail, seqno);
            if (results.length === messageCount) {
              console.log("Seqno here: " + seqno);
              allProcessesDone();
            }
          });
        });
        // msg.once("attributes", (attrs) => {
        //   console.log(prefix + "Attributes: %s", inspect(attrs, false, 8));
        // });
        msg.once("end", () => {
          // when the message has ended
          // maybe here

          console.log(prefix + "Finished");
        });
      });
      f.once("error", (err) => {
        console.log("Fetch error: " + err);
      });
      f.once("end", () => {
        console.log("Done fetching all messages!");
        console.log("Seqnos: " + seqnos);
        // Promise.all
        // Should wait for all messages are done being processed, then set those messages as seen.
        waitForAllProcesses.then(() => {
          imap.seq.setFlags(seqnos, ["\\Seen"], (err) => {
            if (err) throw err;
            console.log("Current SEQNOS: " + seqnos);
          });
          imap.end();
        });
      });
    });
  });
});

const processEmail = (mail, seqno) => {
  console.log("ProcessingEmail " + seqno);
  messageCount++;
  // 1 email = 1 transaction for now
  let body = mail.text;
  // console.log(body);
  // pattern for "Pesanan Selesai" (Tokopedia)
  var completedPattern = /Pesanan Selesai:/;
  // pattern for "telah dikirim" (Shopee)
  var completedPattern2 = /telah dikirim/i;
  if (body.match(completedPattern) || body.match(completedPattern2)) {
    // console.log(body.match(completedPattern));
    // for code pattern #___
    var codePattern = /#([0-9-a-zA-Z]+)/;
    // for code pattern No. Invoice: ____
    var codePattern2 = /No\.\s*Invoice:\s*([a-zA-Z0-9\/._-]+)/;
    // add star in between because Tokopedia use *From:* Tokopedia to bold "From"
    // var marketPattern = /From:[\*]*\s*([a-zA-Z0-9._-]+)/;
    var marketPattern = /Tokopedia/i;
    // pattern for Shopee
    var marketPattern2 = /Shopee/i;
    let user = mail.from.value[0].address;
    // // some code is No. Invoice: ___ instead of #___
    let code = body.match(codePattern)
      ? body.match(codePattern)[1]
      : body.match(codePattern2)
      ? body.match(codePattern2)[1]
      : "no code found";
    let marketplace = body.match(marketPattern)
      ? "Tokopedia" // Tokopedia probably
      : body.match(marketPattern2)
      ? "Shopee" // Shopee
      : "no marketplace found";
    let transaction = {
      user,
      code,
      marketplace,
      num: seqno,
    };
    transactions.push(transaction);
    seqnos.push(seqno);

    console.log("ProcessEmail " + seqno + " finished");
    return true;
  }
  console.log("ProcessEmail " + seqno + " finished");
  return false;
};

imap.once("error", (err) => {
  console.log(err);
});

imap.once("end", () => {
  console.log("Connection ended");
  console.log("Num emails: " + transactions.length);
  console.log(transactions);
  console.log("Seqnos: " + seqnos);
});

const runScript = () => {
  imap.connect();
};

runScript();
// STILL BUG WITH PROCESSING EMAILS
