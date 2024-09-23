const generateDynamicEmail = (firstName, otp) => {

    return `
  

    <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PayWave Verify</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
        }

        .email-container {
            max-width: 500px;
            background-color: #ffffff;
            border: 1px solid #ddd;
        }

        .email-header {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 150px;
            height: auto;
            margin-top: 10px;
            object-fit: contain;
        }

        .email-header img {
            width: 150px;
            height: auto;
        }

        .email-content {
            background-color: white;
            text-align: left;
            color: #333;
            padding: 20px;
        }

        .email-content h1 {
            color: #1a3783;
            font-size: 24px;
        }

        .email-content p {
            font-size: 16px;
            margin: 20px 0;
        }

        .line {
            border-bottom: 1.5px solid #ccc;
            width: 100%;
        }

        .btn {
            display: inline-block;
            background-color: #1a3783;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            font-size: 16px;
            border-radius: 5px;
        }

        .email-content a {
            color: white;
        }

        .email-footer {
            text-align: center;
            padding: 10px 10px;
            font-size: 14px;
            color: #888;
            background-color: #f0efef;
        }

        .email-footer a {
            color: #500050;
            text-decoration: none;
        }

        .email-footer img {
            width: 18px;
            height: 18px;
            object-fit: contain;
        }
    </style>
</head>

<body style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #fafafa6d;">
 <center style="width: 100%; background-color: #fafafa6d;">
    <div class="email-container">
        <div class="email-header">
            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1726434911/paywave-logo1_xvgj1n.png" alt="PayWave Logo">
        </div>
        <div class="email-content">
            <h1>Your Verification</h1>
            <div class="line"></div>
            <p>Hi ${firstName},</p>
              <p>Paywaver, enter this OTP on the verification page to complete your registration.</p>
                <h2 style="font-size: 32px; color: #1a3783; text-align: center; padding: 10px; background-color: #f0f0f0; border-radius: 5px;">${otp}</h2>
                <p>This OTP will expire in 15 minutes.</p>

                <p>You can only use this OTP once. If you didn't request this verification OTP, kindly <a href="https://example.com/support">contact our support team</a>.</p>
        </div>
        <div class="email-footer">
                    <a href="#"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725721/350974_facebook_logo_icon_zoxrpw.png" alt="otpedIn"></a>
                    <a href="#"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725720/twitter-icon_fdawvi.png" alt="Twitter"></a>
                    <a href="#"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725721/Instagram-PNGinstagram-icon-png_yf4g2j.png" alt="Instagram"></a>
                </p>
                <p style="color: #333;">&#10084; &nbsp; <strong>PayWave</strong></p>
                <p>Our vision is to make payment easier <br> and faster across Africa.</p>
                <p style="color: #333;">Lagos, Nigeria</p>
                <p><a href="mailto:support@paywave.com">support@paywave.com</a></p>
        </div>
    </div>
    </center>
</body>

</html>
  
    `
}


module.exports = {generateDynamicEmail}