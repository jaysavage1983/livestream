# Pubub Chat Demo 1

A hosted version of this demo can be found at **[https://chatdemo1.pub-nub.com/](https://chatdemo1.pub-nub.com/)**

![Screenshot](https://raw.githubusercontent.com/PubNubDevelopers/Pubub-Chat-Demo1/main/media/002.png)

## Features of the app and PubNub APIs used

| Feature | PubNub APIs used |
| --- | ---------------- |
| Exchange messages either 1:1 or as part of a group conversation | [Publish & Subscribe](https://www.pubnub.com/docs/sdks/javascript/api-reference/publish-and-subscribe) |
| Show when users come online and go offline | [Presence](https://www.pubnub.com/docs/sdks/javascript/api-reference/presence) |
| Retrieve the past messages in the conversation | [Message Persistence](https://www.pubnub.com/docs/sdks/javascript/api-reference/storage-and-playback) |
| Text moderation | [Functions](https://www.pubnub.com/docs/general/serverless/functions/overview) |


### Requirements
- [PubNub Account](#pubnub-account) (*Free*)

<a href="https://admin.pubnub.com/#/register">
	<img alt="PubNub Signup" src="https://i.imgur.com/og5DDjf.png" width=260 height=97/>
</a>

### Get Your PubNub Keys

1. You’ll first need to sign up for a [PubNub account](https://admin.pubnub.com/signup/). Once you sign up, you can get your unique PubNub keys from the [PubNub Developer Portal](https://admin.pubnub.com/).

1. Sign in to your [PubNub Dashboard](https://admin.pubnub.com/).

1. Click Apps, then **Create New App**.

1. Give your app a name, and click **Create**.

1. Click your new app to open its settings, then click its keyset.

1. Enable the Presence feature on your keyset (check 'Presence Deltas' and 'Generate Leave on TCP FIN or RST')

1. Enable the Message Persistence feature on your keyset and choose a duration

1. Enable the Stream Controller feature on your keyset

1. The hosted variant of this app uses Functions for moderation, specifically [https://www.pubnub.com/integrations/chat-message-profanity-filter/](https://www.pubnub.com/integrations/chat-message-profanity-filter/).

1. Copy the Publish and Subscribe keys and paste them into your app as specified in the next step.

### Building and Running

1. Clone the repository

1. Under the `js` folder, open `keys.js` and add your keys here, replacing the existing placeholder data.

## Contributing
Please fork the repository if you'd like to contribute. Pull requests are always welcome.

## Further Information / Licenses

All avatar images licenced under MIT from [DiceBear](https://dicebear.com/) and [Bootstrap Icons](https://icons.getbootstrap.com/)
