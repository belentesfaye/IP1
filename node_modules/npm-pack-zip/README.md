This tool will create an archive of your package similar to `npm pack`, but will generate a zip file instead of a tarball.

It is designed to help you deploy NPM packages to AWS Lambda or Azure Web Apps.

This project uses the npm-packlist project to build up the list of files to include and all bundle dependencies. Check out their [documentation](https://www.npmjs.com/package/npm-packlist) on how to exclude files from the archive. 

## Installation

`npm install --save-dev npm-pack-zip`

## Example

_my-lambda_ is an npm package I want to run as an AWS Lambda Function.

Install _pack-zip_ locally in _my-lambda_
```
npm install --save-dev npm-pack-zip
```

Install any runtime dependencies of _my-lambda_.
```
npm install
```

Modify _my-lambda/package.json_:
```
"scripts": {
    "pack": "npm-pack-zip"
    ...
}
```

Create the .zip file containing _my-lambda_ and its dependencies, ready to upload to AWS Lambda
```
npm run pack
```

### Static date modified of the files inside the zip
If you need to create `*.zip` package with static date modified of the files inside then you can use the flag `--static-date-modified` . This can be used if you are using automation deployment to the AWS, where the server checkouts the code (brand new) each time deployment is triggered. Hash can be calculated so that you can check with the hash in AWS so that you can check if the code is changed.

```
"scripts": {
    "pack": "npm-pack-zip --static-date-modified"
    ...
}
```

```
"scripts": {
    "pack": "npm-pack-zip --sdm"
    ...
}
```
