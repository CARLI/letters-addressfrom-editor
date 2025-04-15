# letters-addressfrom-editor

This Alma Cloud App allows you to view and edit the addressFrom label values of all your Letters in Alma in one place. Setting the "From" email address to a valid domain increases email delivery and is also crucial for complying with your organization's DMARC policy.

The current method to update an Alma Letter's addressFrom value requires you to:

1) Go to Config > General > Letters > Letters Configuration
2) Locate the Letter
3) Click on Edit
4) Locate the addressFrom label
5) Edit the value
6) Click Save
7) Wait for the update to finish (spinner)
8) Repeat steps 2-7 for each Letter you wish to edit

By using this app, you can do all the above in one place.

To begin, click on the "Retrieve Letters" button:

<img width="361" alt="image" src="https://github.com/user-attachments/assets/df8895e8-463a-4aea-a766-b5b4761efc61" />

This will display all of the letters that you may update:

<img width="400" alt="image" src="https://github.com/user-attachments/assets/615c347b-662f-4b48-9b1e-529519643250" />

You can edit the addressFrom labels for each letter individually. But if you would like to set all of them to the same value, you can do so easily by filling out the "Set addressFrom values" text box:

<img width="400" alt="image" src="https://github.com/user-attachments/assets/0db48250-d32b-4175-9735-27f759100a94" />

(By default, only the enabled letters are displayed and available for updating; if you wish to include disabled letters, too, then check the "Show disabled" box)

## Translation support

If you have multiple languages enabled in Alma, then you will need to perform an additional step for each language. At the bottom of the app, there is an action button, entitled "Update Translations for [language]"; E.g., for Spanish [es], this button will look like this:

<img width="400" alt="image" src="https://github.com/user-attachments/assets/38f9e391-8103-4b3e-ae8a-2ad4d690d752" />

If you notice that this button is not enabled, that means you have made changes to addressFrom label(s) which haven't been saved:

<img width="400" alt="image" src="https://github.com/user-attachments/assets/fe0bc616-b2f3-487f-a952-bef6818ce0f5" />

Once you save these changes (clicking on "Update Letters"), the "Update Translations" button will then be enabled.

As mentioned previously, if you have multiple languages defined, you will need to click on "Update Translations" for each one:

<img width="361" alt="image" src="https://github.com/user-attachments/assets/c790ddc6-6a25-4b91-849c-f1fcb3c55656" />

E.g., after updating the Spanish (es) translations, we may now update the German (de) translations:

<img width="361" alt="image" src="https://github.com/user-attachments/assets/ef0e8a65-2ec2-466b-af89-da8e90f57c5b" />



## Alma privileges needed

This Cloud App requires "General System Administrator" privileges to run.

I was hoping to allow anyone with "Letter Administrator" privileges, but I'm not sure how to do that.

I have found example code that restricts access to a specific role in the Cloud App tutorials here:

https://github.com/ExLibrisGroup/cloudapp-tutorials/blob/tutorials/cloudapp/src/app/configuration/configuration.component.ts#L68

However, in order for that code to work, the user needs to have access to the Users Alma API, which a "Letter Administrator" apparently does *not* have.
Therefore, I'm going to leave the "Admin" privilege requirement.
