// Modules
const express = require('express')
const cookieParser = require('cookie-parser')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

// Routes Path
const authRoutes = require('./Routes/Auth')
const community = require('./Routes/Group')

const app = express()
const port = 5000

// Middlewares
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
}))
app.use(express.json())
app.use(cookieParser())
app.use('/api/', authRoutes)
app.use('/community', community)

app.get('/', (req, res) => {
    res.send('Hello World!')
})

async function connect() {
    try {
        // Try connect to MongoDB
        await mongoose.connect(process.env.DB_URL)
        console.log('MongoDB works perfectly')
        
        // Only start server if DB connection was successful
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`)
        })
    } catch (err) {
        // if DB connection fails
        console.error('Failed to connect to MongoDB');
        console.log(err)
        process.exit(1)
    }
}

connect()