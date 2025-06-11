const AWS = require("aws-sdk");

AWS.config.update({ region: "us-east-1" }); // ajuste para sua região

const lambda = new AWS.Lambda();
const cloudwatchlogs = new AWS.CloudWatchLogs();

const blacklist = ["MainMonitoringFunction", "ModLabRole"];
const keywords = ["ERROR", "Exception", "Traceback"];

async function getLambdaFunctions() {
    let functions = [];
    let Marker;

    do {
        const response = await lambda.listFunctions({ Marker }).promise();
        functions.push(...response.Functions);
        Marker = response.NextMarker;
    } while (Marker);

    return functions
        .map(f => f.FunctionName)
        .filter(name => !blacklist.includes(name));
}

async function getLogStreams(logGroupName) {
    try {
        const response = await cloudwatchlogs.describeLogStreams({
            logGroupName,
            orderBy: "LastEventTime",
            descending: true,
            limit: 5 // ajustável
        }).promise();
        return response.logStreams.map(stream => stream.logStreamName);
    } catch (err) {
        if (err.code === "ResourceNotFoundException") return [];
        throw err;
    }
}

async function getErrorEvents(logGroupName, logStreamName) {
    const response = await cloudwatchlogs.getLogEvents({
        logGroupName,
        logStreamName,
        startTime: Date.now() - 1000 * 60 * 60 * 2, // últimas 2 horas
        endTime: Date.now()
    }).promise();

    return response.events.filter(event =>
        keywords.some(keyword => event.message.includes(keyword))
    );
}

async function main() {
    const lambdaNames = await getLambdaFunctions();
    const allErrors = [];

    for (const lambdaName of lambdaNames) {
        const logGroupName = `/aws/lambda/${lambdaName}`;
        const streams = await getLogStreams(logGroupName);

        for (const streamName of streams) {
            const events = await getErrorEvents(logGroupName, streamName);
            for (const event of events) {
                allErrors.push({
                    function: lambdaName,
                    date: new Date(event.timestamp).toISOString(),
                    message: event.message.trim()
                });
            }
        }
    }

    if (allErrors.length === 0) {
        console.log("✅ Nenhum erro encontrado nas Lambdas analisadas.");
    } else {
        console.log("🚨 Erros encontrados:");
        allErrors.forEach(err => {
            console.log(`---`);
            console.log(`📛 Lambda: ${err.function}`);
            console.log(`📅 Data:   ${err.date}`);
            console.log(`📝 Erro:   ${err.message}`);
        });
    }
}

main().catch(console.error);
