const joi = require('@hapi/joi');
const { z } = require('zod');



// Define the validation function
const validateMerchant = (data) => {
    try {
        // Define the Zod schema for merchant validation
        const merchantValidationSchema = z.object({
            firstName: z.string().min(3, { message: "First Name must be at least 3 characters long" }).nonempty({ message: "First Name is required" }),
            lastName: z.string().min(3, { message: "Last Name must be at least 3 characters long" }).nonempty({ message: "Last Name is required" }),
            businessName: z.string().min(3, { message: "Business Name must be at least 3 characters long" }).nonempty({ message: "Business Name is required" }),
            email: z.string().email({ message: "Please provide a valid email address" }).nonempty({ message: "Email is required" }),
            phoneNumber: z.string().min(10, { message: "Phone Number must be at least 10 digits" }).nonempty({ message: "Phone Number is required" }),
            password: z.string().min(6, { message: "Password must be at least 6 characters long" }).nonempty({ message: "Password is required" }),
            status: z.string().optional().default("not-verified"),
           
        });

        // Return the result from safeParse, it includes both success and error
        return merchantValidationSchema.safeParse(data);
    } catch (error) {
        throw new Error("Error while validating user: " + error.message);
    }
};



// Define the validation function
const validateResetPassword = (data) => {
    try {
        // Zod schema for password validation
        const validateSchema = z.object({
            password: z.string()
                .min(8, { message: "Password must be at least 8 characters long" })
                .max(20, { message: "Password must not exceed 20 characters" })
                .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
                    message: 'Password must contain Lowercase, Uppercase, Numbers, and special characters'
                })
                .nonempty({ message: "Password field can't be left empty" }),
            confirmPassword: z.string()
                .min(8, { message: "Confirm Password must be at least 8 characters long" })
                .max(20, { message: "Confirm Password must not exceed 20 characters" })
                .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
                    message: 'Confirm Password must contain Lowercase, Uppercase, Numbers, and special characters'
                })
                .nonempty({ message: "Confirm Password field can't be left empty" }),
        }).refine((data) => data.password === data.confirmPassword, {
            message: "Password and Confirm Password must match",
            path: ["confirmPassword"],
        });

        // Use safeParse to validate the data and return the result
        return validateSchema.safeParse(data);
    } catch (error) {
        throw new Error("Error while validating user: " + error.message);
    }
};


module.exports = {
    validateMerchant,
    validateResetPassword,

};