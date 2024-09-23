const resetHTML = (userId) => {

    return `
    
    <!DOCTYPE html>
    <html lang="en">
    
    <head>
        <meta charset="utf-8"> <!-- utf-8 works for most cases -->
        <meta name="viewport" content="width=device-width"> <!-- Forcing initial-scale shouldn't be necessary -->
        <meta http-equiv="X-UA-Compatible" content="IE=edge"> <!-- Use the latest (edge) version of IE rendering engine -->
        <meta name="x-apple-disable-message-reformatting"> <!-- Disable auto-scale in iOS 10 Mail entirely -->
        <title></title> <!-- The title tag shows in email notifications, like Android 4.4. -->
        <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">
    </head>
    
    <body style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f1f1f1;">
        <center style="width: 100%; background-color: #f1f1f1;">
            <div
                style="display: none; font-size: 1px;max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
                &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
            </div>
            <div style="max-width: 800px; margin: 0 auto;">
                <!-- BEGIN BODY -->
                <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                    style="margin: auto;">
                    <tr>
                        <td valign="top" style="padding: 1em 2.5em 0 2.5em; background-color: #ffffff;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <!-- <td style="text-align: center;">
                                <h1 style="margin: 0;"><a href="#" style="color: #30e3ca; font-size: 24px; font-weight: 700; font-family: 'Lato', sans-serif;">THE CURVE COHORT3</a></h1>
                              </td> -->
                                </tr>
                            </table>
                        </td>
                    </tr><!-- end tr -->
                    <tr>
                        <td valign="middle" style="padding: 3em 0 2em 0;">
                        <span>FiveSquares</span>
                        <!-- <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1707374851/Rapid_Stock_Control_2_q13o0l.png" alt=""> -->
                                style="width: 200px; max-width: 300px; height: auto; margin: auto; display: block;">
                        </td>
                    </tr><!-- end tr -->
                    <tr>
                        <td style="display: flex; justify-content: center; align-items: center; ">
                            <table>
                                <tr>
                                    <td >
                                        <div style="display: flex; justify-content: center; align-items: center; ">
                                        <div style="padding: 0 2.5em; text-align: center; display: flex; flex-direction: column;">
                                            <h2
                                                style="font-family: 'Lato', sans-serif; color: rgba(0,0,0,.3); font-size: 40px; margin-bottom: 0; font-weight: 400;">
                                                Password Reset</h2>
                                            <h3 style="font-family: 'Lato', sans-serif; font-size: 24px; font-weight: 300;">
                                                Please enter your new password here</h3>
                                                <form id="resetForm" action="/api/reset-user/${userId}" method="post" enctype="application/x-www-form-urlencoded">
                                                    <label for="password" style="font-family: 'Lato', sans-serif; font-size: 18px; font-weight: 300;">New Password:</label>
                                                    <input type="password" style="display: inline-block; width: 200px; height: 35px; font-size: 20px; border-radius: 3px; background: #f1f1f1;  color: #000;" name="password" required>
                                                    <button type="submit" style="display: inline-block; width: 95px; height: 40px; font-size: 20px; border-radius: 3px; background: #0098e1; color: #ffffff; border: none; outline: none;">Submit</button>
                                                </form>
                                            <h6 style="font-family: 'Lato', sans-serif; font-size: 18px; font-weight: 300;">
                                                This email expires in 5minutes</h6>
                                        </div>
                                    </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr><!-- end tr -->
                    <!-- 1 Column Text + Button : END -->
                </table>
                <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr >
                        <div style="margin: auto; display: flex; justify-content: center; align-items: center; ">
                    <a href="https://echo-sphere-blog.onrender.com" target="_blank">
                        <div style="width: auto; height: 40px; object-fit: contain; margin: auto; display: flex;">
                        <span>FiveSquares</span>
                        <!-- <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1707374851/Rapid_Stock_Control_2_q13o0l.png" alt=""> -->
                        </div>
                    </a>
                        <ul style="font-family: Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif; Font-size: 15px; Font-weight: 600; Line-height: 20px; color: rgb(13, 12, 34); display: flex; flex-direction: row; justify-content: space-around; list-style-type: none; width: 400px;">
                            <li>For designers</li>
                            <li>Blog</li>
                            <li>About</li> 
                            <li>Support</li>
                     </ul>
                     <div style="width: 120px; height: 20px; object-fit: contain; margin: auto; display: flex; display: flex; flex-direction: row; justify-content: space-evenly; padding-left: 20px;">
                        <a href="https://twitter.com/your_username" target="_blank" style="height: 20px; object-fit: contain; margin: auto; display: flex; display: flex; flex-direction: row; justify-content: space-evenly;">
                            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725720/twitter-icon_fdawvi.png" alt="twitter" >
                        </a>
                        <a href="https://facebook.com/your_username" target="_blank" style="height: 20px; object-fit: contain; margin: auto; display: flex; display: flex; flex-direction: row; justify-content: space-evenly;">
                            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725721/350974_facebook_logo_icon_zoxrpw.png" alt="facebook" >
                        </a>
                        <a href="https://instagram.com/your_username" target="_blank" style="height: 20px; object-fit: contain; margin: auto; display: flex; display: flex; flex-direction: row; justify-content: space-evenly;">
                            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725721/Instagram-PNGinstagram-icon-png_yf4g2j.png" alt="instagram" >
                        </a>
                        <a href="https://pinterest.com/your_username" target="_blank" style="height: 20px; object-fit: contain; margin: auto; display: flex; display: flex; flex-direction: row; justify-content: space-evenly;">
                            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725720/pinterest-round-logo_lsfeqy.png" alt="pinterest"  >
                        </a>
                     </div>
    
                    </tr><!-- end: tr -->
                    <tr>
                        <td style="text-align: center; background-color: #fafafa;">
                            © Copyright ${new Date().getFullYear()}. All rights reserved. Rapid Stock Control.<br />
                        </td>
                    </tr>
                </div>
                </table>
    
            </div>
        </center>
    
    </body>
    
    </html>
    

    `
}

module.exports = resetHTML;