// packages
const Telegraf = require('telegraf');
const urlRegex = require('url-regex');
const fetch = require('node-fetch');
const ent = require('ent');
const _ = require('lodash');
const db = require('./db');

// init bot
const { Extra, Markup } = Telegraf;
const bot = new Telegraf(process.env.BOT_TOKEN);

// regexs
const titleRegex = /<title>(.+?)<\/title>/gim;

// memory storage
const memoryStore = {};

// categories list
const categories = ['Articles & News', 'Releases', 'Libs & Demos', 'Silly stuff'];

// helper functions
const sanitizeTitle = title => title.replace(/[\n\r\t]+/gm, ' ');
const generateMarkdown = async (userId) => {
  const {links} = await db.findOne({userId});
  
  const groupedLinks = _.groupBy(links, it => it.category);
  
  const markdown = categories.map(category => {
    const header = `\n## ${category}\n`
    const links = groupedLinks[category] ? groupedLinks[category].map(link => `- [${sanitizeTitle(link.title)}](${link.url})\n`).reduce((acc, val) => acc + val, '') : ' - No links yet\n';
    return `${header}${links}`;
  }).reduce((acc, val) => acc + val, '');
  
  return markdown;
};

// basic messages
const welcomeMessage = `Welcome! 
I am BxJS Telegram Bot.
Send me your links to store them.`;
const helpMessage = `Send me a link`;

// basic commands
bot.start((ctx) => ctx.reply(welcomeMessage));
bot.help((ctx) => ctx.reply(helpMessage));

// listen to commands
bot.hears(/new collection (.+)/, async (ctx) => {
  const userId = ctx.from.id;
  const collectionName = ctx.match[1];
  
  // remove all old collection
  await db.remove({userId}, {multi: true});
  
  // create new
  await db.insert({userId, collectionName, links: []});
  
  ctx.reply(`New collection created with name: ${collectionName}`);
});
bot.hears(urlRegex(), async (ctx) => {
  // get urls from message text
  const urls = ctx.message.text.match(urlRegex());
  const firstUrl = urls[0];
  
  // get url title
  const body = await fetch(firstUrl).then(r => r.text());
  const titleTag = body.match(titleRegex);
  const title = ent.decode(titleTag.pop().replace('<title>', '').replace('</title>', ''));
  
  // get userId
  const userId = ctx.from.id;
  memoryStore[userId] = {url: firstUrl, title, category: ''};
  
  ctx.reply(`Ready to save: "${title}".
What category should it be?`, Markup.keyboard(categories).oneTime().resize().extra());
});
// category handling
categories.forEach(category => {
  bot.hears(category, async (ctx) => {
    const userId = ctx.from.id;
    const linkObject = memoryStore[userId]; // {url: firstUrl, title, category: ''};
    linkObject.category = category;

    // find current collection
    await db.update({userId}, {$push: {links: linkObject}});

    ctx.reply(`Saved link into ${category}: ${memoryStore[userId].title}`);
  });
});

bot.hears(/generate markdown/i, async (ctx) => {
  const userId = ctx.from.id;  
  const markdown = await generateMarkdown(userId);
  ctx.reply(markdown, Extra.webPreview(false));
});

bot.hears(/generate preview/i, async (ctx) => {
  const userId = ctx.from.id;  
  const markdown = await generateMarkdown(userId);
  ctx.reply(markdown, Extra.markdown().webPreview(false));
});

// start bot
bot.startPolling();
