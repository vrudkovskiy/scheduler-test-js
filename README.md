## Run
```
> redis-server

> npm i

> npm run start # listens to port 3000
> npm run start1 # listens to port 3001
> npm run start2 # listens to port 3002
```
Test request example:

POST http://localhost:3000/echoAtTime
```
{
	"dateTime": "Mon Mar 11 2019 07:29:00 GMT+0200",
	"text": "Test race condition"
}
```
