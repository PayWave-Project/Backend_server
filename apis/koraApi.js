const axios = require("axios");
const KORAPAY_API_URL = process.env.KORAPAY_API_URL;
const KORAPAY_API_BASE_URL = process.env.KORAPAY_API_BASE_URL;
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;


const verifyBVNWithKoraPay = async (BVN) => {
    try {       
      const response = await axios.post(
        `${KORAPAY_API_BASE_URL}/api/v1/identities/ng/bvn`,
        { id: BVN, verification_consent: true },
        {
          headers: {
            Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      // console.log(response.data)
      return {
        isValid: response.data.status === "true",
        data: response.data.data,
      };
    } catch (error) {
      console.error("Error verifying BVN:", error.response?.data || error.message);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      return { isValid: false, error: error.message };
    }
  }
  
  //  Function to verify CAC with KoraPay
async function verifyCACWithKoraPay(CAC) {
  try {
    const response = await axios.post(
      `${KORAPAY_API_BASE_URL}/api/v1/identities/ng/cac`,
      {
        id: CAC,
        verification_consent: true
      },
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
      // Check if the response indicates a valid CAC
      const isValid = response.data.status === "success" && response.data.data.valid === true;
      // console.log(response.data)
      return {
        isValid,
        data: response.data.data
      };
  } catch (error) {
    console.error("Error verifying CAC:", error);
    throw new Error("Failed to verify CAC with KoraPay");
  }
}



module.exports= {
  verifyCACWithKoraPay,
  verifyBVNWithKoraPay,
};

// Function to login a verified Merchant account
exports.logIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all the fields below!" });
    }

    const checkEmail = await merchantModel.findOne({
      email: email.toLowerCase(),
    });

    if (!checkEmail) {
      return res.status(404).json({
        message: "Merchant not registered",
      });
    }

    const checkPassword = bcrypt.compareSync(password, checkEmail.password);
    if (!checkPassword) {
      return res.status(404).json({
        message: "Password is incorrect",
      });
    }

    const token = jwt.sign(
      {
        userId: checkEmail._id,
      },
      process.env.SECRET,
      { expiresIn: "20h" }
    );

    checkEmail.token = token;
    await checkEmail.save();

    const loginTime = new Date().toLocaleString();
    console.log(`Successful login: ${checkEmail.email} (${checkEmail.businessName}) at ${loginTime}`);

    // Send login notification email
    await sendLoginNotification(checkEmail.email, checkEmail.firstName, loginTime);

    const details = {
      firstName: checkEmail.firstName,
      email: checkEmail.email,
      businessName: checkEmail.businessName,
      phoneNumber: checkEmail.phoneNumber,
      userId: checkEmail._id,
    };

    if (checkEmail.isVerified) {
      return res.status(200).json({
        message: "Login Successfully! Welcome " + checkEmail.businessName,
        token: token,
        merchant: details,
      });
    } else {
      return res.status(400).json({
        message: "Sorry Merchant not verified yet. Check your mail to verify your account!",
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};




