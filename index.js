const AWS = require('aws-sdk');

AWS.config.update({ region: "us-east-1" }); // ajuste sua região

const lambda = new AWS.Lambda();
const cloudwatchlogs = new AWS.CloudWatchLogs();

async function getAllLambdaLogs() {
    try {
        const functionsData = await lambda.listFunctions().promise();

        for (const func of functionsData.Functions) {
            const logGroupName = `/aws/lambda/${func.FunctionName}`;
            console.log(`📘 Verificando logs da função: ${func.FunctionName}`);

            try {
                const streamsData = await cloudwatchlogs.describeLogStreams({
                    logGroupName,
                    orderBy: "LastEventTime",
                    descending: true,
                    limit: 3 // você pode ajustar isso
                }).promise();

                for (const stream of streamsData.logStreams) {
                    const logEventsData = await cloudwatchlogs.getLogEvents({
                        logGroupName,
                        logStreamName: stream.logStreamName,
                        startTime: Date.now() - 1000 * 60 * 60 * 1, // Última 1 hora
                        endTime: Date.now()
                    }).promise();

                    console.log(`📝 Logs de ${func.FunctionName} / ${stream.logStreamName}:`);
                    for (const event of logEventsData.events) {
                        console.log(`- ${event.message.trim()}`);
                    }
                }
            } catch (err) {
                if (err.code === 'ResourceNotFoundException') {
                    console.log(`⚠️ Sem logs encontrados para: ${func.FunctionName}`);
                } else {
                    console.error(`Erro ao acessar logs de ${func.FunctionName}:`, err);
                }
            }
        }
    } catch (err) {
        console.error("Erro ao listar funções Lambda:", err);
    }
}

getAllLambdaLogs();
