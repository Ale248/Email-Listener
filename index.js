require("dotenv").config();
const imaps = require("imap-simple");
const Imap = require("imap");
const path = require("path");
const express = require("express");
const inspect = require("util").inspect;
const MailListener = require("mail-listener-next");
const simpleParser = require("mailparser").simpleParser;

// const

// var config = {
//   imap: {
//     user: `${process.env.EMAIL_USER}`,
//     password: `${process.env.EMAIL_PASS}`,
//     host: `${process.env.EMAIL_HOST}`,
//     port: 993,
//     tls: true,
//     authTimeout: 3000,
//     tlsOptions: {
//       rejectUnauthorized: false,
//     },
//   },
// };

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
  imap.openBox("INBOX", true, cb);
}

var emails = [];

// fill emails array with UNSEEN emails from inbox
// email[i] = {
//   from: "",
//   subject: "",
//   body: "",
// };
imap.once("ready", function () {
  openInbox(function (err, box) {
    if (err) throw err;
    console.log(box.messages.total + " message(s) found!");
    // search inbox for UNSEEN messages
    imap.search(["UNSEEN"], function (err, results) {
      if (err) throw err;
      // fetch results of the search
      var f = imap.seq.fetch(results, {
        bodies: "",
      });
      f.on("message", function (msg, seqno) {
        // seqno is the email's number from very first email (eg. 5th email)
        console.log("Message #%d", seqno);
        var prefix = "(#" + seqno + ") ";
        msg.on("body", function (stream, info) {
          simpleParser(stream, (err, mail) => {
            if (err) throw err;
            // console.log(prefix + mail.from.value[0].address);
            // console.log(prefix + mail.subject);
            // console.log(prefix + mail.text);
            let newEmail = {
              from: mail.from.value[0].address,
              subject: mail.subject,
              body: mail.text,
            };
            emails.push(newEmail);
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

// imap.once("ready", function () {
//   openInbox(function (err, box) {
//     if (err) throw err;
//     console.log(box.messages.total + " message(s) found!");
//     // 1:* - Retrieve all messages
//     // 3:5 - Retrieve messages #3,4,5
//     var f = imap.seq.fetch("1:*", {
//       bodies: "",
//     });
//     f.on("message", function (msg, seqno) {
//       console.log("Message #%d", seqno);
//       var prefix = "(#" + seqno + ") ";

//       msg.on("body", function (stream, info) {
//         // use a specialized mail parsing library (https://github.com/andris9/mailparser)
//         simpleParser(stream, (err, mail) => {
//           // console.log(prefix + mail.from.value[0].address);
//           // console.log(prefix + mail.subject);
//           // console.log(prefix + mail.text);
//           let newEmail = {
//             from: mail.from.value[0].address,
//             subject: mail.subject,
//             body: mail.text,
//           };
//           emails.push(newEmail);
//         });

//         // or, write to file
//         //stream.pipe(fs.createWriteStream('msg-' + seqno + '-body.txt'));
//       });
//       msg.once("attributes", function (attrs) {
//         console.log(prefix + "Attributes: %s", inspect(attrs, false, 8));
//       });
//       msg.once("end", function () {
//         console.log(prefix + "Finished");
//       });
//     });
//     f.once("error", function (err) {
//       console.log("Fetch error: " + err);
//     });
//     f.once("end", function () {
//       console.log("Done fetching all messages!");
//       imap.end();
//     });

//     // search example
//     //    imap.search([ 'UNSEEN', ['SINCE', 'May 20, 2010'] ], function(err, results) {
//     //      if (err) throw err;
//     //      var f = imap.fetch(results, { bodies: '' });
//     //      ...
//     //    }
//   });
// });

imap.once("error", function (err) {
  console.log(err);
});

const processBody = (body) => {
  // body is a string
  console.log(body);
  var example = "alejandro@yahoo.com";
  var emailPattern = /^([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+)\.[a-zA-Z]{2,4}$/;
  // no need to get user because we already have it from simpleParser
  // get e-commerce website (Tokopedia, Shopee, Amazon, etc)
  var fromPattern = /From:\s*([a-zA-Z0-9._-]+)/;
  // get order number
  var orderNumPattern = /#([0-9-a-zA-Z]+)/;
  console.log("User: " + body.match(userPattern)[1]);
  console.log("From: " + body.match(fromPattern)[1]);
  console.log("Order Number: " + body.match(orderNumPattern)[1]);
};

// const processEmails = () => {
//   var emailPattern = /^([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+)\.[a-zA-Z]{2,4}$/;
//   for (let i = 0; i < emails.length; i++) {}
// };

imap.once("end", function () {
  console.log("Connection ended");
  // process emails after connection ended
  console.log(emails);
  // processBody(emails[0].body);
});

imap.connect();

// test comment
