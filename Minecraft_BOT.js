
//Minecraft_BOT.js
const mineflayer = require('mineflayer')
const openai = require('openai');
const { Configuration, OpenAIApi } = openai;
const {pathfinder, Movements, goals} = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const mcData = require('minecraft-data');

let isWorking = false;


const configuration = new Configuration({
  apiKey: 'YOUR_OPENAI_API_KEY',
});
const openaiClient = new OpenAIApi(configuration);          
const bot = mineflayer.createBot({
  host: 'localhost',
    port: 25565,
    username: 'Bot'


})

bot.loadPlugin(pathfinder);




async function askChatGPT(pronmpt){

    return openaiClient.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
            {
                role: 'system',
                content: 'You are a helpful assistant that helps a Minecraft bot find and mine minerals in the game.'
            },
            {
                role: 'user',
                content: pronmpt
            }
        ]
    }).then(response => {
        const answer = response.data.choices[0].message.content;
        return answer;
    }).catch(error => {
        console.error('Error communicating with OpenAI:', error);
        return null;
    }); 
}

const MineralsThatPlayerWantsNow = {
    "coal_ore": false,
    "iron_ore": false,
    "gold_ore": false,
    "diamond_ore": false,
    "emerald_ore": false,
    "nether_quartz_ore": false,
    "nether_gold_ore": false



}


function getsMineralsThatPlayerWantsNow(){
    return Object.keys(MineralsThatPlayerWantsNow).filter(key => MineralsThatPlayerWantsNow[key] === true);
}

bot.on('spawn', () => {
    console.log('Bot has spawned in the world!');
    try {
        const mcDataInstance = mcData(bot.version);
        const defaultMove = new Movements(bot, mcDataInstance);
        bot.pathfinder.setMovements(defaultMove);}
    catch (error) {
        console.error('Having trouble loading mcData for version', bot.version, error);
    }
   
}   )



bot.on('chat', async (username, message) => {

    if (username === bot.username) return; // Ignore messages from the bot itself
    const prompt = `You are a helpful assistant that helps a Minecraft bot find and mine minerals in the game. The user has asked for the following: "${message}". Please provide a list of minerals that the user wants, in JSON format, with the mineral names as keys and boolean values indicating whether the bot should mine them or not.`
    const response = await askChatGPT(prompt);
    if(!response){
        console.error('No response received from OpenAI.');
        return;
    }
    let parse;

    try {
        parse = JSON.parse(response);
    } catch(error){
        console.error('Error parsing OPENAI response:', error);
        return;
    } 

    for (const mineral in parse){
        if (Object.prototype.hasOwnProperty.call(MineralsThatPlayerWantsNow, mineral)) {
            MineralsThatPlayerWantsNow[mineral] = !!parse[mineral];
        } else {
            console.warn(`Mineral "${mineral}" is not recognized. Please ensure it is a valid Minecraft mineral.`);
        }
    }

});


function Mineral(mineral){
    setInterval(() => {
        const found = MineralsThatPlayerWantsNow[mineral];

        if (found === null) {
            MineralsThatPlayerWantsNow[mineral] = true;
        } else if (found === true) {
            return;
        }

        if (MineralsThatPlayerWantsNow[mineral] === true) {
            bot.chat(`You want ${mineral}!`);
        }
    }, 1000);

}

function getDesiredMineralsKeys(){
    return Object.keys(MineralsThatPlayerWantsNow).filter(key => MineralsThatPlayerWantsNow[key] === true);
}
    
setInterval(async ()=>{
    if(isWorking === true){
        console.log('Bot is currently working on mining minerals. Please wait until it finishes before asking for new minerals.');
        return;
    } 

    isWorking = true;

    const mineralsfound = getDesiredMineralsKeys();
    try {
        const pickaxe = bot.inventory.items().find(item => item.name.includes('pickaxe'));
        if (!pickaxe) {
            console.log('No pickaxe found in inventory!');
            return;
        }

        const block = bot.findBlock({matching: block => block.name.includes('ore') && mineralsfound.includes(block.name)});
        if(!block){
            console.log ('[DEBUG] No matching block found for the minerals you want to mine. Please ensure that the minerals you want are available in the world and that their names are correctly specified in the response from OpenAI.');
            return;
        } else {
            console.log(`[DEBUG] Found block: ${block.name} at position (${block.position.x}, ${block.position.y}, ${block.position.z})`);
        }

        try{
            bot.pathfinder.setGoal(new GoalBlock(block.position.x, block.position.y, block.position.z));

        } catch(error){
            console.error('Error setting pathfinder goal:', error);
            return;
        }

        await bot.equip(pickaxe, 'hand');
        try{
             await bot.dig(block);
        } catch(error){
            console.error('Error digging block:', error);
            return;

        }
       
        


    } catch (error) {
        console.error('Error during mining operation:', error);
    } finally {
        isWorking = false;
    }
    

}, 1000);