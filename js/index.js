/**
 * Many customers use PubNub to implement chat into their solution, so they don't have to
 * worry about scale, reliability or other infrastructure considerations.  If you are reading
 * this source code, hopefully you are implementing an app with PubNub :)  THANK YOU!
 * Here are some tips for things you'll need to watch out for as you move to production, this is
 * just a demo and beyond the usual caveats to add 'error handling' code, it's worth bearing the
 * following in mind
 * IN PRODUCTION:
 * - PubNub provides all the underlying APIs you need to implement your chat solution but we don't
 *   provide an opinionated visual design - feel free to build your own UI on top of our APIs, this
 *   demo uses a very basic chat UI to 'get the idea across'
 * - PubNub uses a flexible channel architecture for communication, endpoints 'subscribe' and 'publish'
 *   messages to channels.  By naming channels in a sensible hierarchy you can enable public and
 *   private groups.  This demo follows the same naming convention a number of our customers use for
 *   'Public.<channel>', 'Private.<channel>' and 'DM.A~B', enabling all possible grouping use cases.
 *   In production, you will use Access Manager to restrict access to channels as appropriate but that
 *   is not done in this demo, for readability.
 * - This demo does not encrypt any messages, but you could do this if you chose to do so for additional
 *   privacy and security.  Obviously all messages are already sent over secure connection and PubNub
 *   is SOC2 compliant so even if you do not choose to implement message encryption, your messages are
 *   still secure.
 * - Subscription: This demo uses wildcard subscription in conjunction with the channel naming topology
 *   to listen for new messages.  This will be sufficient for most production use cases but if you need
 *   an even greater number of channels then please see our Channel Groups feature.
 * - Presence: This demo uses PubNub's Presence APIs to detect who is online.  Presence is based subscription
 *   which, in the case of this demo, is to 'channel.*', so a user will be shown as online even if they are
 *   not viewing the same conversation as you.  Presence is configurable at both the client and server level,
 *   for example you can choose to unsubscribe / resubscribe to channels as you switch conversations and additional
 *   options are available on the admin portal (for example, unsubscribing when a TCP ACK is received).
 * - Typing indicator: We recommend you use PubNub signals, as this demo does.  This demo's logic for the typing
 *   indicator with groups, where multiple people are typing, is quite simple (especially the use of setTimeout).
 *   In production, you would have more robust logic but, again, the demo was written with readibility in mind.
 *   PubNub signals will meet your typing indicator use case regardless of scale.
 * - Message Persistence: The chat history in this hosted demo only persist for 1 day.  That is a deliberate choice since
 *   this is only a demo but in production, this is something you can configure from your PubNub admin dashboard, so
 *   data can be persisted as long as you need.  The Message Persistence API (you may also see this referred to as the history API) can retrieve messages (along with
 *   their accompanying reaction) as far back as you need but for readibility, this demo only goes back to the past
 *   30 messages.
 * - Functions: Functions provide server logic that can be exeuted after an event occurs, such as a message is published
 *   or a file is uploaded.  Functions are used by this demo to moderate text but are not used beyond
 *   that.  In production, you might choose to use functions to perform inline language translation or to store a
 *   copy of any message in your own storage for analytics purposes (you can also use Events & Actions for this
 *   analytics use case)
 */
var predefined_groups = {
  groups: [
    {
      channel: 'Public.global',
      name: 'Online Users',
      profileIcon: 'group-global.png',
      info: 'All users currently online'
    }
  ]
}
//  List of remote users (not ourselves) that we know about
var userData = null
//  Our own data, populated on startup
var me = null
//  The currently active channel ID
var channel = null
const MAX_MESSAGES_SHOWN_PER_CHAT = 50
//  Connection to the PubNub Api
var pubnub = null

//  To make Presence indications more accurate if the webpage is being refreshed, notify PubNub that the client is leaving .
//  PubNub will eventually catch up, but this makes it quicker
window.addEventListener('beforeunload', function () {
  pubnub.unsubscribeAll()
})

//  Called by page onload()
async function load () {
  //  Bootstrap application
  userData = {}
  activeTypers = {}

  //  Handle Message input field
  document
    .getElementById('input-message')
    .addEventListener('keypress', function (event) {
      sendTypingIndicator()
      if (event.key === 'Enter') {
        messageInputSend()
      }
    })
  if (!testPubNubKeys()) {
    console.error('You are missing your PubNub Keys')
    return
  }

  //  Create an instance of PubNub by assigning a random user ID.  This is very bad practice in production and
  //  you should use an identity unique to that user, assuming they have first logged in and registered with
  //  your application through your own authentication mechanism / identity provider.
  pubnub = new PubNub({
    publishKey: publish_key,
    subscribeKey: subscribe_key,
    userId: '' + Math.floor(Math.random() * names.length + 1)
  })
  PubNub.prototype.getUserId = function () {
    return this.getUUID()
  }
  var accessManagerToken = await requestAccessManagerToken(pubnub.getUserId());
  if (accessManagerToken == null)
  {
    console.log('Error retrieving access manager token')
  }
  else
  {
    pubnub.setToken(accessManagerToken)
    //  The server that provides the token for this app is configured to grant a time to live (TTL)
    //  of 120 minutes (i.e. 2 hours).  IN PRODUCTION, for security reasons, you should set a value 
    //  between 10 and 60 minutes and refresh the token before it expires.
    //  For simplicity, this app does not refresh the token
  }

  pubnub.addListener({
    message: payload => {
      //  A chat message has been received
      messageReceived(payload, false)
    },
    signal: signalEvent => {
      //  A notification that somebody is typing has been received
      signalReceived(signalEvent)
    },
    presence: presenceEvent => {
      //  Someone has either gone online or offline
      handlePresenceEvent(presenceEvent.action, presenceEvent)
    }
  })

  //  Populate own data (var me)
  populateOwnData(pubnub.getUserId())

  //  Subscribe to required channels
  pubnub.subscribe({
    channels: ['DM.*', 'Public.*'],
    withPresence: true
  })

  //  Populate the list of 'channels' and populate that list
  populatePredefinedGroups()

  //  Get the users currently subscribed to the shared channel
  getActiveUsers()

  //  Add some extra users to the direct messages list who are offline
  addNewUser(400, lookupUsername(400), lookupProfileUrl(400))
  addNewUser(401, lookupUsername(401), lookupProfileUrl(401))
  addNewUser(402, lookupUsername(402), lookupProfileUrl(402))

  //  Always launch on the first of the predefined groups
  channel = predefined_groups.groups[0].channel
  populateChatWindow(channel)
}

function testPubNubKeys () {
  if (publish_key === '' || subscribe_key === '') return false
  else return true
}

//  Based on our random ID, find the names and avatar that correspond with that ID
function populateOwnData (userId) {
  me = {}
  me.userId = userId
  me.name = lookupUsername(userId)
  me.profileUrl = lookupProfileUrl(userId)

  //  This app is structured to duplicate the JS elements in the side panel for mobile
  document.getElementById('currentUser').innerText = me.name + ' (You)'
  document.getElementById('currentUser-side').innerText = me.name + ' (You)'
  document.getElementById('avatar').src = me.profileUrl
  document.getElementById('avatar-side').src = me.profileUrl
}

function lookupUsername (userId) {
  var username = names[userId % names.length]
  return username
}

function lookupProfileUrl (userId) {
  var profileUrl = avatars[userId % avatars.length]
  return profileUrl
}

//  Render the HTML for the list of groups on the left of the app, e.g. online users
function populatePredefinedGroups () {
  var groupList = ''
  var groupListSide = ''
  var channels = []
  for (const group of predefined_groups.groups) {
    //  This app is structured to duplicate the JS elements in the side panel for mobile
    var groupHtml = generatePredefinedGroupHTML(group, false)
    var groupHtmlSide = generatePredefinedGroupHTML(group, true)
    groupList += groupHtml
    groupListSide += groupHtmlSide
    channels.push(group.channel)
    document.getElementById('groupList').innerHTML = groupList
    document.getElementById('groupList-side').innerHTML = groupListSide
  }
}

function generatePredefinedGroupHTML (group, isSide) {
  var idDelta = ''
  if (isSide) idDelta = 's'
  var groupHtml =
    "<div class='user-with-presence group-row group-row-flex' onclick='launchGroupChat(\"" +
    group.channel +
    "\")'><img src='./img/group/" +
    group.profileIcon +
    "' class='chat-list-avatar'><div id='unread-" +
    idDelta +
    group.channel +
    "' class='text-caption presence-dot-online-num' style='visibility: hidden'>0</div>"

  if (typeof group.info === 'undefined') {
    groupHtml += "<div class='group-name'>" + group.name + '</div></div>'
  } else {
    groupHtml +=
      "<div class='group-name group-name-flex'><div>" +
      group.name +
      "</div><div class='text-caption'>" +
      group.info +
      '</div></div></div>'
  }
  return groupHtml
}

//  Rely on PubNub presence to tell us who is currently subscribed to the 'all online users' channel.
//  This is called on application launch and the state of who is and isn't online is updated with
//  presence events.
function getActiveUsers () {
  try {
    pubnub
      .hereNow({
        channels: ['Public.*'],
        includeUUIDs: true,
        includeState: true
      })
      .then(users => {
        for (var i = 0; i < users.channels['Public.*'].occupancy; i++) {
          handlePresenceEvent('join', {
            uuid: users.channels['Public.*'].occupants[i].uuid
          })
        }
      })
  } catch (status) {
    console.log(status)
  }
}

//  Handler for a Presence event, either 'join', 'leave', or 'interval'
function handlePresenceEvent (action, presenceEvent) {
  var userId = presenceEvent.uuid
  if (action == 'join') {
    memberJoined(userId)
  } else if (action == 'leave') {
    memberLeft(userId)
  } else if (action == 'interval') {
    //  'join' and 'leave' will work up to the ANNOUNCE_MAX setting (defaults to 20 users)
    //  Over ANNOUNCE_MAX, an 'interval' message is sent.  More info: https://www.pubnub.com/docs/presence/presence-events#interval-mode
    //  The below logic requires that 'Presence Deltas' be defined for the keyset, you can do this from the admin dashboard
    if (
      typeof presenceEvent.join === 'undefined' &&
      typeof presenceEvent.leave === 'undefined'
    ) {
      //  No change since last interval update.
    } else {
      if (
        typeof presenceEvent.join !== 'undefined' &&
        presenceEvent.join.length > 0
      ) {
        for (const joiner of presenceEvent.join) {
          memberJoined(joiner)
        }
      }
      if (
        typeof presenceEvent.leave !== 'undefined' &&
        presenceEvent.leave.length > 0
      ) {
        for (const leaver of presenceEvent.leave) {
          memberLeft(leaver)
        }
      }
    }
  }
}

//  The specified user has joined the chat.  For clarity, this demo app is considering the user 'present' if they
//  are viewing ANY group, though you could also choose to have the user present only if they are viewing
//  (or subscribed to) a specific group (channel)
function memberJoined (userId) {
  if (userId == me.userId) {
    return
  }
  addNewUser(userId, lookupUsername(userId), lookupProfileUrl(userId))
  var directChatAvatar = document.getElementById('user-pres-' + userId)
  if (userData[userId] != null) {
    if (userData[userId] != null && userData[userId].presence != 'join') {
      userData[userId].presence = 'join'
      if (directChatAvatar != null) {
        directChatAvatar.classList.remove('presence-dot-gray')
        directChatAvatar.classList.add('presence-dot-online')
        //  And the sidebar variant
        var directChatAvatarS = document.getElementById('user-pres-s' + userId)
        directChatAvatarS.classList.remove('presence-dot-gray')
        directChatAvatarS.classList.add('presence-dot-online')
      }
    }
  }
  getGroupMembers()
}

//  The specified user has left the chat
function memberLeft (userId) {
  removeUser(userId)
  var directChatAvatar = document.getElementById('user-pres-' + userId)
  if (userData[userId] != null) {
    if (userData[userId].presence != 'leave') {
      userData[userId].presence = 'leave'
      if (directChatAvatar != null) {
        directChatAvatar.classList.remove('presence-dot-online')
        directChatAvatar.classList.add('presence-dot-gray')
        //  And the sidebar variant
        var directChatAvatarS = document.getElementById('user-pres-s' + userId)
        directChatAvatarS.classList.remove('presence-dot-online')
        directChatAvatarS.classList.add('presence-dot-gray')
      }
    }
  }
  getGroupMembers()
}

//  Add a new REMOTE user to the system, not including ourselves
async function addNewUser (userId, name, profileUrl) {
  if (userData[userId] != null && Object.keys(userData[userId]).length != 0) {
    //  Do not add the same user more than once
    return
  }
  //  A new user is present in the chat system.
  //  Add this user's details to our local cache of user details
  userData[userId] = { name: name, profileUrl: profileUrl }

  //  Add this user to the left hand pane of direct chats.
  var oneOneUser = generateOneOneUser(userId, profileUrl, name, false)
  var oneOneUserSide = generateOneOneUser(userId, profileUrl, name, true)

  document.getElementById('oneOneUserList').innerHTML =
    oneOneUser + document.getElementById('oneOneUserList').innerHTML
  document.getElementById('oneOneUserList-side').innerHTML =
    oneOneUserSide + document.getElementById('oneOneUserList-side').innerHTML

  var tempChannel = createDirectChannelName(pubnub.getUserId(), userId)
}

//  Generate the HTML for the list of direct chats in the left hand pane.  Note that there are two
//  copies of each user, one shown on mobile and one shown on the desktop
function generateOneOneUser (userId, profileUrl, name, isSide) {
  var idDelta = ''
  if (isSide) idDelta = 's'
  var user =
    " <div id='user-" +
    idDelta +
    userId +
    "' class='user-with-presence group-row' onclick='launchDirectChat(\"" +
    userId +
    "\")'><img src='" +
    profileUrl +
    "' class='chat-list-avatar'><span id='user-pres-" +
    idDelta +
    userId +
    "' class='presence-dot-gray'></span><div id='unread-" +
    idDelta +
    userId +
    "' class='text-caption presence-dot-online-num' style='visibility: hidden'>0</div><span class='chat-list-name'>" +
    name +
    '</span></div>'
  return user
}

//  Remove a user from the system, this can happen if the user logs out.
function removeUser (userId) {
  try {
    delete userData[userId]
    var leftPaneUser = document.getElementById('user-' + userId)
    leftPaneUser.parentNode.removeChild(leftPaneUser)
  } catch (e) {}
}

function createDirectChannelName (userId1, userId2) {
  if (userId1 <= userId2) return 'DM.' + userId1 + '~' + userId2
  else return 'DM.' + userId2 + '~' + userId1
}

function launchGroupChat (channelName) {
  channel = channelName
  populateChatWindow(channel)

  let myOffCanvas = document.getElementById('chatLeftSide')
  let openedCanvas = bootstrap.Offcanvas.getInstance(myOffCanvas)
  if (openedCanvas !== null) {
    openedCanvas.hide()
  }
}

//  Handler for when a user is selected in the 1:1 chat window.  Display the chat with that user
async function launchDirectChat (withUserId) {
  //  Channel name of direct chats is just "DM.[userId1]~[userId2]" where userId1 / userId2 are defined by whoever is lexicographically earliest
  var userId1 = pubnub.getUserId()
  var userId2 = withUserId
  if (withUserId < pubnub.getUserId()) {
    userId1 = withUserId
    userId2 = pubnub.getUserId()
  }

  channel = 'DM.' + userId1 + '~' + userId2
  populateChatWindow(channel)

  let myOffCanvas = document.getElementById('chatLeftSide')
  let openedCanvas = bootstrap.Offcanvas.getInstance(myOffCanvas)
  if (openedCanvas !== null) {
    openedCanvas.hide()
  }
}

//  Method to handle all the logic of populating the chat window with the chat
//  associated with the specified channel
async function populateChatWindow (channelName) {
  //  Update the heading
  if (channelName.startsWith('Public')) {
    //  This is a public group
    document.getElementById('heading').innerHTML = lookupGroupName(channelName)
    //  todo uncomment this?
    getGroupMembers(channelName)
  } else if (channelName.startsWith('DM')) {
    //  1:1 message between two users
    var recipientName = lookupRemoteOneOneUser(channelName)
    document.getElementById('heading').innerHTML =
      '1:1 Chat with ' + recipientName
    getGroupMembers(channelName)
  }
  //  Clear message list
  var messageListContents = document.getElementById('messageListContents')
  messageListContents.innerHTML = ''
  //  If we select a channel to view it, clear all unread messages for this channel
  setChannelUnreadCounter(channelName, 0)

  //  Get the meta data for other users in this chat.  This will be stored locally for efficiency.  If we see a new user after the chat
  //  is loaded, that user's data will be loaded dynamically as needed
  try {
    //  Load channel 
    pubnub
      .fetchMessages({
        channels: [channelName],
        count: 30, //  Limit to 30 messages.  Design decision for this app, not a limitation of PubNub
        includeUUID: true
      })
      .then(async history => {
        if (history.channels[channelName.replace('~', '%7E')] != null) {
          for (const historicalMsg of history.channels[
            channelName.replace('~', '%7E')
          ]) {
            try {
              historicalMsg.publisher = historicalMsg.uuid
              historicalMsg.channel = decodeURIComponent(historicalMsg.channel)
              messageReceived(historicalMsg, true)
            } catch (e) {
              //  Malformed message in history
              console.log(e)
            }
          }
        }
      })
  } catch (status) {
    console.log(
      'error (check you have message persistence enabled in the admin portal): ' +
        status
    )
  }
}

//  Given a channel, return the corresponding group name (from chat-constants.js)
function lookupGroupName (channelName) {
  //  Look in the predefined groups
  for (const group of predefined_groups.groups) {
    if (group.channel == channelName) return group.name
  }
}

//  Populate the subheading of who is present in the currently active channel.
//  Only returns values for the 'online users' group.  If you add additional
//  groups, you will need to work out what makes them a member of the channel
//  and update the subheading accordingly.
function getGroupMembers () {
  for (const group of predefined_groups.groups) {
    if (channel == predefined_groups.groups[0].channel) {
      var names = ''
      //  All online users
      for (const user of Object.keys(userData)) {
        if (userData[user].presence && userData[user].presence == 'join') {
          names += userData[user].name
          names += ', '
        }
      }
      names += me.name + ' (You)'
      document.getElementById('subheading').innerHTML = names
    } else {
      //  add additional groups here
      document.getElementById('subheading').innerHTML = ''
    }
  }
}

//  Given the channel name of a direct chat, return the name of the person being spoken with
function lookupRemoteOneOneUser (channelName) {
  try {
    //  Find the remote ID which is contained within the direct channel name
    var remoteId = channelName
    remoteId = remoteId.replace(pubnub.getUserId(), '')
    remoteId = remoteId.replace('DM.', '')
    remoteId = remoteId.replace('~', '')
    return userData[remoteId].name
  } catch (e) {
    console.log(e)
    return 'unknown'
  }
}

//  User has pressed the send button or pressed return in the input field.
function messageInputSend () {
  var messageInput = document.getElementById('input-message')
  var messageText = messageInput.value
  if (messageText !== '') {
    try {
      //  Publish the message to PubNub.  Message text plus the URL of any file attachment, which will be null if there is no attachment
      pubnub.publish({
        channel: channel,
        storeInHistory: true,
        message: {
          content: {
            type: 'chat',
            text: messageText
          }
        }
      })
    } catch (err) {
      console.log('Error sending message: ' + err)
    }
    messageInput.value = ''
  }
}

//  Handler for the PubNub message event
async function messageReceived (messageObj, isFromHistory) {
  try {
    if (messageObj.channel != channel) {
      //  The message has been recevied on a channel we are not currently viewing, update the unread message indicators
      incrementChannelUnreadCounter(messageObj.channel)
      return
    }
    var messageDiv = ''
    if (messageObj.publisher == pubnub.getUserId()) {
      //  If the read receipt was added as a message reaction before we could draw the message, do that now
      var messageIsRead = true
      //  The sent and received messages have slightly different styling, ergo different HTML
      messageDiv = createMessageSent(messageObj, messageIsRead)
    } else {
      //  The sent and received messages have slightly different styling, ergo different HTML
      messageDiv = createMessageReceived(messageObj)
    }

    //  Limit the number of messages shown in the chat window
    var messageListDiv = document.getElementById('messageListContents')
    if (messageListDiv.children.length >= MAX_MESSAGES_SHOWN_PER_CHAT) {
      messageListDiv.removeChild(messageListDiv.children[0])
    }

    document.getElementById('messageListContents').appendChild(messageDiv)
  } catch (e) {
    console.log('Exception during message reception: ' + e)
  }
}

//  HTML for messages we have sent ourselves
function createMessageSent (messageObj, messageIsRead) {
  var readSrc = './img/icons/read.png'
  var profileUrl = lookupProfileUrl(messageObj.publisher)
  var name = lookupUsername(messageObj.publisher)
  var newMsg = document.createElement('div')
  newMsg.id = messageObj.timetoken
  newMsg.className =
    'text-body-2 temp-message-container temp-message-container-me'
  newMsg.innerHTML = `
  <div class="text-body-2 temp-message-container temp-message-container-me ninetyPercent">
    <div class="temp-message temp-mesage-me">
        <div class="temp-message-meta-container temp-message-meta-container-me">
            <div class="text-caption temp-message-meta-time">
                ${convertTimetokenToDate(messageObj.timetoken)}
            </div>
        </div>
        <div class="temp-message-bubble temp-message-bubble-me">
            ${messageContents(messageObj.message)}
            <div class="temp-read-indicator">

                <img class="temp-read-indicator-me" id='message-check-${
                  messageObj.timetoken
                }'
                    src="${readSrc}" height="10px">
            </div>
        </div>
    </div>
</div>`

  return newMsg
}

//  HTML for messages we have received
function createMessageReceived (messageObj) {
  var profileUrl = lookupProfileUrl(messageObj.publisher)
  var name = lookupUsername(messageObj.publisher)
  var extraReceiptStyle = ''
  if (messageObj.channel.startsWith('DM.')) {
    //  Hide read receipts in direct chats and the private IoT chat
    extraReceiptStyle = 'hidden'
  }
  var newMsg = document.createElement('div')
  newMsg.id = messageObj.timetoken
  newMsg.className =
    'text-body-2 temp-message-container temp-message-container-you'
  newMsg.innerHTML = `
  <div class='temp-message-avatar'>
  <img src='${profileUrl}' class='chat-list-avatar temp-message-avatar-img'>
  </div>
  <div class='temp-message temp-mesage-you'>
  <div class='temp-message-meta-container temp-message-meta-container-you'>
      <div class='text-caption temp-message-meta-name'>
          ${name}
      </div>
      <div class='text-caption temp-message-meta-time'>
      ${convertTimetokenToDate(messageObj.timetoken)}
      </div>
  </div>
  <div class='temp-message-bubble temp-message-bubble-you'>
      ${messageContents(messageObj.message)}
      <div class='temp-read-indicator'>
          <img id='message-check-${
            messageObj.timetoken
          }' class='${extraReceiptStyle}' src='./img/icons/read.png' height='10px'>
      </div>
  </div>
</div>
  `

  return newMsg
}

//  Wrapper function to cater for whether the message had an associated image
function messageContents (messageData) {
  return messageData.content.text
}

function incrementChannelUnreadCounter (channel) {
  //  Just use the span text to track the current value and increment it (indicated by -1)
  setChannelUnreadCounter(channel, -1)
}

//  Update unread message indicator for the specified channel
function setChannelUnreadCounter (channel, count) {
  try {
    if (!channel.includes('Private.')) {
      channel = channel.replace(pubnub.getUserId(), '')
      channel = channel.replace('DM.', '')
      channel = channel.replace('~', '')
    }
    //  This app is structured to duplicate the JS elements in the side panel for mobile
    var unreadMessage = document.getElementById('unread-' + channel)
    var unreadMessageSide = document.getElementById('unread-s' + channel)
    if (unreadMessage == null) {
      return
    }
    if (count == -1) {
      //  Increment current count by 1
      var currentCount = unreadMessage.innerText
      if (currentCount == '') currentCount = 0
      else currentCount = parseInt(currentCount)
      count = currentCount + 1
    }
    unreadMessage.innerText = count
    if (count == 0) {
      //  No unread messages - hide the unread message counter
      unreadMessage.style.visibility = 'hidden'
    } else {
      unreadMessage.style.visibility = 'visible'
    }
    unreadMessageSide.innerText = unreadMessage.innerText
    unreadMessageSide.style.visibility = unreadMessage.style.visibility
  } catch (e) {
    console.log(e)
  }
}

var months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]
//  Convert PubNub timetoken to a human readable date
function convertTimetokenToDate (timetoken) {
  var timestamp = new Date(timetoken / 10000)
  var hours = timestamp.getHours()
  var ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12
  hours = hours ? hours : 12
  return (
    months[timestamp.getMonth()] +
    ' ' +
    (timestamp.getDate() + '').padStart(2, '0') +
    ' - ' +
    (hours + '').padStart(2, '0') +
    ':' +
    (timestamp.getMinutes() + '').padStart(2, '0') +
    ampm
  )
}

async function requestAccessManagerToken (userId) {
  try {
    const TOKEN_SERVER = 'https://devrel-demos-access-manager.netlify.app/.netlify/functions/api/chatdemo1'
    const response = await fetch(`${TOKEN_SERVER}/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ UUID: userId })
    })

    const token = (await response.json()).body.token
    //console.log('created token: ' + token)

    return token
  } catch (e) {
    console.log('failed to create token ' + e)
    return null
  }
}
