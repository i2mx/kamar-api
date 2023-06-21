import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { parse } from "https://deno.land/x/xml/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log(`Function "browser-with-cors" up and running!`)

serve(async (req) => {
  if (req.method == "GET"){
    return new Response("get timetable data by sending a POST request with portal, studentID and password data in the body")
  }
  // This is needed if you're planning to invoke your function from a browser.
  try {
    const params = await req.json();
    const { portal, studentID, password } = params;
    const url = `https://${portal}/api/api.php`

    async function sendCommand(command: string, body) {
      const data = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'KAMAR API Demo',
          'Origin': 'file://',
          'X-Requested-With': 'nz.co.KAMAR'
        },
        body: new URLSearchParams({
          'Key': 'vtku',
          'Command': command, ...body
        })
      })

      const xml = await data.text()
      const json = await parse(xml)
      return json
    }


    let res = await sendCommand("Logon", {
      'Username': studentID,
      'Password': password
    })

    const key = res.LogonResults.Key

    const globals = await sendCommand("GetGlobals", {
      Key: key
    })

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), 0);
    const dayOfYear = Math.floor((today - firstDay) / 1000 / 60 / 60 / 24) + 1;

    const calendar = await sendCommand("GetCalendar", {
      Key: key,
      Year: today.getFullYear()
    })

    const week = calendar.CalendarResults.Days.Day[dayOfYear].WeekYear

    const timetable = await sendCommand("GetStudentTimetable", {
      Key: key,
      StudentID: studentID,
      Grid: `${today.getFullYear()}TT`
    })

    const periodDefinition = globals.GlobalsResults.PeriodDefinitions.PeriodDefinition
    const weekly = timetable.StudentTimetableResults.Students.Student.TimetableData[`W${week}`]

    
    const daysOfTheWeek = [weekly['D1'], weekly['D2'], weekly['D3'], weekly['D4'], weekly['D5']]
    
    const weeklyPlan = daysOfTheWeek.map(
      day => day.split('|').map(
        (period, index) => {
          const definition = periodDefinition[index-1]
          return [definition ? definition.PeriodName : null, definition ? definition.PeriodTime : null, ...period.split('-')]
        }
      ).filter(period => period[0])
    )

    return new Response(JSON.stringify(weeklyPlan), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.log('womp womp')
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})