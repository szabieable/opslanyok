const dotenv = require('dotenv')
const axios = require("axios");
const reader = require("readline-sync");
var moment = require('moment-business-days');
var _ = require('lodash');

function getEaster() {
    var f = Math.floor,
        // Golden Number - 1
        G = moment().year() % 19,
        C = f(moment().year() / 100),
        // related to Epact
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        // number of days from 21 March to the Paschal full moon
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        // weekday for the Paschal full moon
        J = (moment().year() + f(moment().year() / 4) + I + 2 - C + f(C / 4)) % 7,
        // number of days from 21 March to the Sunday on or before the Paschal full moon
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);

    return moment(moment().year() + '-' + month + '-' + day, "YYYY-MM-DD");
}

let goodFriday = getEaster().prevBusinessDay().format('MM-DD');
let easterMonday = getEaster().nextBusinessDay().format('MM-DD');
let whitMonday = getEaster().add(7, 'w').nextBusinessDay().format('MM-DD');

moment.updateLocale('us', {
    holidays: ['03-15', '08-20', '01-01', '12-24', '12-25', '10-23', '12-26', '12-31', '05-01', goodFriday, easterMonday, whitMonday],
    holidayFormat: 'MM-DD'
});
require('dotenv').config()
if (process.env.APITOKEN === "" || process.env.SUBSCRIPTION === "" || process.env.EMAIL === "") {
    console.log(".env values are missing")
    process.exit(1);
}
let project = 0;
let taskid = 0;

axios.defaults.baseURL = 'https://incepteam.tickspot.com';
axios.defaults.headers.common['Authorization'] = 'Token token=' + process.env.APITOKEN;
axios.defaults.headers.common['User-Agent'] = 'Opslanyok (' + process.env.EMAIL + ')';
axios.defaults.headers.common['Accept'] = '*/*';
(async () => {
    async function getProject() {
        try {
            const response = await axios.get(process.env.SUBSCRIPTION + '/api/v2/projects.json');
            for (var attr in response.data) {
                console.log(response.data[attr].id + "\t" + response.data[attr].name);
            }
        } catch (error) {
            console.log(error);
            process.exit(1);
        }
    };
    await getProject();
    project = reader.question("Project id: ");
    if (isNaN(project)) {
        console.log('Invalid project id');
        project = reader.question("Project id: ");
    }
    async function getTask() {
        try {
            const response = await axios.get(process.env.SUBSCRIPTION + '/api/v2/projects/' + project + '/tasks.json');
            taskid = response.data[0].id;
        } catch (error) {
            console.log(error);

        }
    };
    await getTask();
    async function fillDays(workday) {
        let data = {
            date: workday,
            hours: 8,
            task_id: taskid
        };
        const configAxios = {
            headers: {
                'User-Agent': 'Opslanyok (' + process.env.EMAIL + ')',
                'Content-Type': 'application/json',
                'Accept': '*/*'
            },
        };
        return await axios.post(process.env.SUBSCRIPTION + '/api/v2/entries', data, configAxios)
            .catch(function (error) {
                console.log(error);
                process.exit(1);
            });
    };
    const startOfMonth = moment().clone().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = moment().clone().endOf('month').format('YYYY-MM-DD');
    async function getTasks() {
        return await axios.get(process.env.SUBSCRIPTION + '/api/v2/entries', { params: { start_date: startOfMonth, end_date: endOfMonth } })
    }
    var businessDays = moment(startOfMonth, 'YYYY-MM-DD').monthBusinessDays();
    const tasks = await getTasks();
    var tasksDate = (tasks.data).map(a => a.date);
    var businessDate = businessDays.map(b => b.format('YYYY-MM-DD'));
    for (const i of businessDays) {
        if (tasksDate.includes(moment(i).format('YYYY-MM-DD'))) {
            console.log('Skipping date ' + i.format('YYYY-MM-DD'));
        }
        else {
            var result = await fillDays(moment(i).format('YYYY-MM-DD'));
            console.log('Logged for ' + moment(i).format('YYYY-MM-DD') + ' ' + result.statusText);
        }


    }
})()