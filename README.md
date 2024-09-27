# PayWave Server

## Description
PayWave NQR is an online application that helps merchant seemlessly accept payment from their customers using the QR Code service, Where the merchant create a QR Code for payment, the customer scans the QR Code and make payment. It also provides other payment solutions such as pay with card or bank transfer. 

This project is a backend application built with Node.js, Express.js, and MongoDB. It provides a RESTful API.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Database Setup](#database-setup)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/PayWave-Project/Backend_server.git


2.   Install the dependencies:

    npm install

3.  Create a .env file in the root directory and add the following environment variables:

    -    PORT = your_port_number
    -    DATABASE = your_mongodb_connection_string
    -    SECRET = your_jwt_secret
    -    MAIL_PASS = your_mail_password
    -    MAIL_USER = your_email_address
    -    MAIL_SERVICE = mail_service (e.g: gmail, yahoo, privateemail)
    -    CLOUD_NAME = cloudinary_cloud_name
    -    API_KEY = 6cloudinary_api_key
    -    API_SECRET = cloudinary_api_secret
    -    KORAPAY_SECRET_KEY = korapay_secret_key
    -    KORAPAY_PUBLIC_KEY = korapay_public_key
    -    KORAPAY_ENCRYPTION_KEY = korapay_encryption_key
    -    KORAPAY_API_BASE_URL = korapay_base_url


## Usage

To start the server, run the following command:

    npm run dev


## Database Setup

Make sure you have MongoDB installed and running. Create a database for this project and update the MONGODB_URI as (DATABASE) in the .env file to connect to your MongoDB instance.


## Technologies Used
-    Node.js
-    Express.js
-    Mongoose
-    JWT for authentication
-    Node.js
-    Axios
-    Bcrypt
-    Cloudinary
-    JSON Web Token (JWT)
-    Multer
-    Nodemailer
-    Nodemon
-    QRCode
-    Sharp
-    Zod



## Contributing
Contributions are welcome! Please follow these steps:

-    Fork the repository.
-    Create a new branch (git checkout -b feature-branch).
-    Make your changes and commit them (git commit -m 'Add new feature').
-    Push to the branch (git push origin feature-branch).
-    Open a pull request.

