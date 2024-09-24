require('./config/dbConfig');
const express = require('express');
require('dotenv').config();
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const webhookRouter = require('./routers/webhookRouter');
const paymentRouter = require('./routers/paymentRouter');
const merchantRouter = require('./routers/merchantRouter');
const paymentService = require('./routers/paymentLogicRouter');
const withdrawRouter = require('./routers/withdrawRouter');


const corsOptions = {
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"]
};

// Middleware for CORS
app.use(cors(corsOptions));

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true })); 

// Define routes
app.get('/', (req, res) => {
    res.send("Welcome to PayWave NQR API 🎉🎉🎉");
});

// Use the webhook router
app.use('/api/v1', webhookRouter); 

// Routes
app.use('/api/v1', paymentRouter);
app.use('/api/v1', merchantRouter);
app.use('/api/v1', paymentService);
app.use('/api/v1', withdrawRouter);


// Add error handling middleware for JSON parsing errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        // Handle JSON parsing error
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    res.status(500).json({ message: 'Internal Server Error: ' + err });
    next();
});


// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server up and running on port: ${port} 🎉🎉🎉`);
});