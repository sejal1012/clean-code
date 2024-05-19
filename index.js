#!/usr/bin/env node

/**
 * clean-code
 * cleans code
 *
 * @author viraj patil
 */

const init = require("./utils/init");
const cli = require("./utils/cli");
const log = require("./utils/log");
const axios = require("axios");
require("dotenv").config();
const { OpenAIApi, Configuration } = require("openai");
const { OpenAI, LLMChain, PromptTemplate } = require("langchain");
const { ConversationSummaryMemory } = require("langchain/memory");
const fs = require("fs");
const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;
const openaiConfig = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const data = require('./rules.json');

const openaiClient = new OpenAIApi(openaiConfig);

const jsonData = fs.readFileSync("rules.json", "utf8");
const parsedData = JSON.parse(jsonData);


function loopRulesByTopic(data) {
  let ruleList =[]
  let index = 1
  for (let topic in data) {
    let rules = data[topic];
    rules.forEach((rule) => {
      ruleList.push(`${index}. ${rule} \n`)
      index++
      
    });
  }
  return ruleList

}


(async () => {
  init({ clear });
  input.includes(`help`) && cli.showHelp(0);
  debug && log(flags);
  if (input.includes("clean")) {
    const directoryPath = input[1];
    for (let topic in data) {
      let rules = data[topic];
      processFiles(directoryPath,topic,rules);
    }
  }
})();


function processFiles(directoryPath,topic,data) {
  fs.readdir(directoryPath, (err, fileNames) => {
    if (err) {
      console.error("Error reading directory:", err);
      return;
    }

    fileNames.forEach((fileName) => {
      const filePath = `${directoryPath}/${fileName}`;
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error("Error getting file stats:", err);
          return;
        }

        if (stats.isDirectory()) {
          processFiles(filePath); // Recursively process subdirectories
        } else {
          fs.readFile(`${input[1]}/${fileName}`, "utf-8", async (err, data) => {
            if (err) {
              return;
            }
            const text = data;
            const fileName2 = fileName.split(".js")[0];
            const llm = new OpenAI({
              modelName: "text-davinci-003",
              temperature: 0,
              openAIApiKey: process.env.OPEN_API_KEY,
            });
            const ruleData = loopRulesByTopic(parsedData)
            const gettingList = ()=>{
              let rule = ``
              ruleData.forEach(ele=>{
                rule = rule + ele
              })
              return rule
            }
            
    

            const promptTemplate = `You are a clean code expert. You have to verify the given code snippet based on the below rules and assign a score out of 5 for each of the rules. 
							:\n${gettingList()

              }\nGive a brief justification of your scoring along with examples of what can be done in the code to improve it.\nDo not send me the corrected code in response.\nI want response in following format\nRuleName: abc Score :- 2   justification: \n{chat_history}\nHuman: {input}\nAI:`;
              console.log(promptTemplate);
            const prompt = PromptTemplate.fromTemplate(promptTemplate);
            const summary_memory = new ConversationSummaryMemory({
              llm: llm,
              memoryKey: "chat_history",
            });
            const conversation = new LLMChain({
              llm: llm,
              memory: summary_memory,
              prompt: prompt,
            });
            let result = await conversation.predict({
              input: text,
                                                                                                                                        
            });
            console.log(result);
            const lines = result
              .split("\n")
              .filter((line) => line.trim() !== "");
            const resultData = lines.map((line) => {
              if (line) {
                const [rule, justification] = line.split("justification:");
                const [ruleName, rating] = rule.split("Score :-") || [];

                return {
                  ruleName: ruleName ? ruleName.replace("RuleName:", "") : "",
                  justification: justification
                    ? justification.replace(/,/g, " and")
                    : "",
                  rating: rating ? rating.trim() : "",
                };
              } else {
                return {
                  ruleName: "",
                  justification: "",
                  rating: "",
                };
              }
            });
            if (fs.existsSync(`reports/${fileName}result.csv`)) {
              console.log("CSV file already exists");
              fs.unlink(`reports/${fileName}result.csv`, (err) => {
                if (err) {
                  console.error("Error deleting CSV file:", err);
                } else {
                  const csvContent = [
                    ["RuleName", "Justification", "Score"],
                    ...resultData.map((obj) => [
                      obj.ruleName,
                      obj.justification,
                      obj.rating,
                    ]),
                  ]
                    .map((row) => row.join(","))
                    .join("\n");

                  fs.writeFile(
                    `reports/${fileName}result.csv`,
                    csvContent,
                    "utf8",
                    (err) => {
                      if (err) {
                        console.error(
                          "An error occurred while writing the file:",
                          err
                        );
                      } else {
                        console.log(
                          `CSV file has been successfully saved for ${fileName2}`
                        );
                      }
                    }
                  );
                  console.log(
                    `deleted and created successfully for ${fileName2} `
                  );
                }
              });
            } else {
              const csvContent = [
                ["RuleName", "Justification", "Score"], // Column names
                ...resultData.map((obj) => [
                  obj.ruleName,
                  obj.justification,
                  obj.rating,
                ]),
              ]
                .map((row) => row.join(","))
                .join("\n");

              fs.writeFile(
                `reports/${fileName}result.csv`,
                csvContent,
                "utf8",
                (err) => {
                  if (err) {
                    console.error(
                      "An error occurred while writing the file:",
                      err
                    );
                  } else {
                    console.log(
                      `CSV file has been successfully saved. for ${fileName2}`
                    );
                  }
                }
              );
            }
          });
        }
      });
    });
  });
}
