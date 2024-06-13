function generateInboxObject(message, person) {
  return {
    _id: message._id,
    chatroom_id: message.chatroom_id,
    person_id: person._id,
    fullname: person.fullname.toTitleCase(),
    content: message.content,
    seen:
      message.sender_id.toString() === person._id.toString()
        ? true
        : message.seen,
    sender_id: message.sender_id,
    timestamp: message.timestamp,
  };
}

module.exports = { generateInboxObject };
