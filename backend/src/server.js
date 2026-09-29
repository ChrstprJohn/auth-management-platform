import express from 'express'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.disable('x-powered-by')
app.use(express.json())

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'auth-dashboard-backend' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Auth dashboard backend listening on port ${port}`)
})
