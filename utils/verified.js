const verifiedHTML = (req) => {
    return  `

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification Success</title>
    <style>
        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #667eea, #764ba2);
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }

        .container {
            max-width: 400px;
            background-color: #fff;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 15px 25px rgba(0, 0, 0, 0.1);
            text-align: center;
            animation: slideDown 0.5s ease-out;
        }

        @keyframes slideDown {
            from {
                transform: translateY(-30px);
                opacity: 0;
            }

            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        h1 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #333;
        }

        p {
            color: #666;
            line-height: 1.6;
            margin: 10px 0;
        }

        .success-icon {
            margin-bottom: 2px;
        }

        .success-icon img {
            width: 150px;
            height: auto;
        }

        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #1ca3e4, #1a377a);
            color: #fff;
            padding: 12px 25px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            border-radius: 50px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .btn:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="success-icon">
            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1726435946/ezgif.com-video-to-gif-converter_1_nvnhny.gif" alt="Success Icon">
        </div>
        <h1>Email Verification Successful!</h1>
        <p>Your email has been successfully verified. You can now proceed to login.</p>
        <p>Thank you for choosing Venture Tribe.</p>
        <a href="#" class="btn">Proceed to Home</a>
    </div>

    <script>
        setTimeout(() => {
            window.location.href = "#"; // Change to your home page URL
        }, 5000)
    </script>
</body>

</html>



`

}

module.exports = verifiedHTML