# letters-addressfrom-editor

This app allows you to view and edit the addressFrom label values of all your enabled Letters in Alma in one place. Setting the "From" email address to a valid domain increases email delivery and is also crucial for complying with your organization's DMARC policy.

The current method to update an Alma Letter's addressFrom value requires you to:

1) Go to Config > General > Letters > Letters Configuration
2) Locate the Letter
3) Click on Edit
4) Locate the addressFrom label
5) Edit the value
6) Click Save
7) Wait for the update to finish (spinner)
8) Repeat steps 2-7 for each Letter you wish to edit

By using this app, you can do all the above in a single step.

Screenshot:

![image](https://user-images.githubusercontent.com/6808751/212369041-56e9e5b6-b750-4cbe-8478-486f734bcebd.png)

Note:

This Cloud App requires "General System Administrator" privileges to run.

I was hoping to allow anyone with "Letter Administrator" privileges, but I'm not sure how to do that.

I have found example code that restricts access to a specific role in the Cloud App tutorials here:

https://github.com/ExLibrisGroup/cloudapp-tutorials/blob/tutorials/cloudapp/src/app/configuration/configuration.component.ts#L68

However, in order for that code to work, the user needs to have access to the Users Alma API, which a "Letter Administrator" apparently does *not* have.
Therefore, I'm going to leave the "Admin" privilege requirement.
