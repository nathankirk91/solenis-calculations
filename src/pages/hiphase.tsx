import React, { useState, useEffect } from "react"
import { PageProps } from "gatsby"

import Layout from "../components/layout"
import Seo from "../components/seo"

type DataProps = {}

const HiPhase: React.FC<PageProps<DataProps>> = ({ data, path }) => {
  const [adductLevel, setAdductLevel] = useState(12.6)
  const [adductFlow, setAdductFlow] = useState(1480)
  const [timeLeft, setTimeLeft] = useState("")
  const [finishTime, setFinishTime] = useState("")
  const [latestStartTime, setLatestStartTime] = useState("")

  useEffect(() => {
    const calculateBatchTime = () => {
      const timeToFinish = (adductLevel * 1000) / adductFlow + 0.75
      setTimeLeft(timeToFinish.toFixed(2))
      const currentDate = new Date().getTime()
      const timeToFinishMs = timeToFinish * 60 * 60 * 1000
      const shiftEnd = new Date()
      shiftEnd.setHours(21, 10, 0, 0)
      const shiftEndTimeMs = shiftEnd.getTime()
      setFinishTime(new Date(currentDate + timeToFinishMs).toLocaleTimeString())
      setLatestStartTime(
        new Date(shiftEndTimeMs - timeToFinishMs).toLocaleTimeString()
      )
    }
    calculateBatchTime()
  }, [adductFlow, adductLevel])

  return (
    <Layout>
      <Seo title="Hi-Phase" />
      <h1>Hi-Phase</h1>
      <section>
        <h3>Batch Time</h3>
        <div>
          <input
            type="number"
            placeholder="Adduct Tank Level"
            onChange={e => {
              setAdductLevel(parseFloat(e.target.value))
            }}
            value={adductLevel}
          />
          <span>tonne</span>
        </div>
        <div>
          <input
            type="number"
            placeholder="Adduct flowrate"
            onChange={e => {
              setAdductFlow(parseFloat(e.target.value))
            }}
            value={adductFlow}
          />
          <span>kg/hr</span>
        </div>
        <div>
          <p>Time to complete batch {timeLeft} hour(s)</p>
        </div>
        <div>
          <p>Finish Time: {finishTime}</p>
        </div>
        <div>
          <p>Latest start Time: {latestStartTime}</p>
        </div>
      </section>
    </Layout>
  )
}

export default HiPhase
