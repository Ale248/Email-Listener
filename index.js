require("dotenv").config();
const Imap = require("imap");
const path = require("path");
const express = require("express");
const inspect = require("util").inspect;
const simpleParser = require("mailparser").simpleParser;

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
  // has to be false to mark as read
  imap.openBox("test", false, cb);
}

var transactions = [];

// fill transactions array with info from UNREAD emails from inbox
// transactions[i] = {
//   user: "",
//   code: "",
//   marketplace: "",
//   status: "",
// };
imap.once("ready", function () {
  imap.getBoxes(function (err, boxes) {
    console.log(boxes);
  });
  openInbox(function (err, box) {
    if (err) throw err;
    console.log(box.messages.total + " message(s) found!");
    // search inbox for UNSEEN messages
    imap.search(["UNSEEN"], function (err, results) {
      if (err) throw err;
      if (results.length === 0) {
        // if all emails are read
        console.log("No unread emails");
        imap.end();
        return;
      }
      // mark emails as read
      // imap.setFlags(results, ["\\Seen"], function (err) {
      //   if (!err) {
      //     console.log("Marked as read");
      //   } else {
      //     console.log(JSON.stringify(err, null, 2));
      //   }
      // });
      // fetch results of the search
      var f = imap.seq.fetch(results, {
        bodies: "",
      });
      f.on("message", function (msg, seqno) {
        // seqno is the email's number from very first email (eg. 5th email)
        console.log("Message #%d", seqno);
        var prefix = "(#" + seqno + ") ";
        msg.on("body", function (stream, info) {
          // use a specialized mail parsing library (https://github.com/andris9/mailparser)
          simpleParser(stream, (err, mail) => {
            if (err) throw err;
            // console.log(prefix + mail.subject);
            // console.log(prefix + mail.text);
            processEmail(mail, seqno);
          });
        });
        msg.once("attributes", function (attrs) {
          console.log(prefix + "Attributes: %s", inspect(attrs, false, 8));
        });
        msg.once("end", function () {
          console.log(prefix + "Finished");
        });
      });
      f.once("error", function (err) {
        console.log("Fetch error: " + err);
      });
      f.once("end", function () {
        console.log("Done fetching all messages!");
        imap.end();
      });
    });
  });
});

imap.once("error", function (err) {
  console.log(err);
});

// transactions[i] = {
//   user: "",
//   code: "",
//   marketplace: "",
//   status: "",
// };
// only process completed transactions
const processEmail = (mail, seqno) => {
  // 1 email = 1 transaction for now
  let body = mail.text;

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
      : "no code found";

    let transaction = {
      user,
      code,
      marketplace,
      num: seqno,
    };
    transactions.push(transaction);
    // console.log(body);
  }
};

imap.once("end", function () {
  console.log("Connection ended");

  console.log("Num emails: " + transactions.length);
  console.log(transactions);
});

imap.connect();

// CEK YG COMPLETE/DELIVERED ONLY YG LAIN IGNORE AJAAA
