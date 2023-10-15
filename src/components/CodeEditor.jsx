import React, { useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import axios from "axios";
import { useParams } from "react-router-dom";
import { Button } from "@chakra-ui/react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Box,
  Flex,
} from "@chakra-ui/react";
import OpenAI from "openai";
import Spaces from "@ably/spaces";
import { Realtime } from "ably";

const extensions = [javascript({ jsx: true })];

const CodeEditor = () => {
  const { id } = useParams();
  const [codeDetails, setCodeDetails] = useState({});
  const [show, setShow] = useState(false);
  const [credits, setCredits] = useState(null);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [testCases, setTestCases] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiResponse, setAIResponse] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [userSet, setUserSet] = useState(new Set());

  useEffect(() => {
    getAllMembersofChannel()
    allSpaceStuff();
  }, []);

  useEffect(() => {
    // Make an API request to fetch code details by ID
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/code/${id}`)
      .then((response) => {
        setCodeDetails(response.data);
        setCode(response.data.function);
      })
      .catch((error) => {
        console.error("Error fetching code details:", error);
      });
  }, [id]);

  const handleChange = (e) => {
    setCode(e);
  };
  const getOutput = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/execute`,
        {
          code: code,
          codeId: id,
          email: localStorage.getItem("email"),
        }
      );
      setTestCases(response.data.testResults);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const getSolution = async () => {
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/managecreds`,
        {
          email: localStorage.getItem("email"),
        }
      );

      if (res.data.success) {
        setCredits(true);
        setShow(true);
      } else {
        setCredits(false);
        setShow(true);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handlePayment = async () => {
    const options = {
      key: process.env.REACT_APP_RAZORPAY_KEY,
      key_secret: process.env.REACT_APP_RAZORPAY_KEY_SECRET,
      amount: 100 * 100,
      currency: "INR",
      name: "CodeAbly",
      description: "Credits",
      handler: function (response) {
        console.log(response);
        alert("payment done");
      },
      prefill: {
        name: "CodeAbly",
        email: "payment@CodeAbly.com",
        contact: "7878787832",
      },
      notes: {
        address: "CodeAbly Corporate office",
      },
      theme: {
        color: "#F37254",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();

    //now credit 100 to user
    setTimeout(async () => {
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/addcredits`,
        {
          email: localStorage.getItem("email"),
        }
      );

      if (res.data.success) {
        setCredits(true);
      } else {
        setCredits(false);
      }
    }, 12000);
  };

  const getAIHelp = async () => {
    setLoadingAI(true);
    setShowModal(true);
    try {
      const openai = new OpenAI({
        apiKey: process.env.REACT_APP_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const chatCompletion = await openai.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Explain the code for ${codeDetails.question} in python.`,
          },
        ],
        model: "gpt-3.5-turbo",
      });
      //console.log(chatCompletion.choices[0].message.content);
      setAIResponse(chatCompletion.choices[0].message.content);
    } catch (err) {
      console.log(err);
    } finally {
      setLoadingAI(false);
    }
  };

  const currentURL = window.location.href;
  const url = new URL(currentURL);
  const spaceName = url.searchParams.get("space");


  const allSpaceStuff = async () => {
    if (spaceName) {
      const client = new Realtime.Promise({
        key: process.env.REACT_APP_ABLY_KEY,
        clientId: process.env.REACT_APP_ABLY_CLIENDID,
      });

      const spaces = new Spaces(client);
      const space = await spaces.get(spaceName, {
        offlineTimeout: 180_000,
      });

      await space.enter({ name: localStorage.getItem("name") });

      const allMembers = await space.members.getAll();

      space.members.subscribe("enter", (memberUpdate) => {
        const { profileData } = memberUpdate;
        if (profileData && profileData.name) {
          if (!userSet.has(profileData.name)) {
            setUserSet(
              (prevUserSet) => new Set([...prevUserSet, profileData.name])
            );
          }
        }
      });

      space.members.subscribe("leave", (memberUpdate) => {
        // console.log(memberUpdate, "leave ----");

        const { profileData } = memberUpdate;
        if (profileData && profileData.name) {
          setUserSet((prevUserSet) => {
            const newUserSet = new Set(prevUserSet);
            newUserSet.delete(profileData.name);
            return newUserSet;
          });
        }
        
      });

    } else {
      console.log("No 'space' parameter found in the URL.");
    }
  };

  const getAllMembersofChannel = async () => {
    if (spaceName) {
      const client = new Realtime.Promise({
        key: process.env.REACT_APP_ABLY_KEY,
        clientId: process.env.REACT_APP_ABLY_CLIENDID,
      });

      const spaces = new Spaces(client);

      const space = await spaces.get(spaceName, {
        offlineTimeout: 180_000,
      });

      const allMembers = await space.members.getAll();

      allMembers.forEach((member) => {
        const { profileData } = member;
        if (profileData && profileData.name) {
          if (!userSet.has(profileData.name)) {
            setUserSet((prevUserSet) => new Set([...prevUserSet, profileData.name]));
          }
        }
      });
    }
  };

  function hashEmail(email) {
    const md5 = require("md5");
    return md5(email.trim().toLowerCase());
  }

  return (
    <Box m={6}>
      <Flex>
        {Array.from(userSet).map((userName, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <img
              src={`https://www.gravatar.com/avatar/${hashEmail(
                userName
              )}?d=identicon`}
              alt={`${userName}'s avatar`}
              style={{ width: "24px", height: "24px", borderRadius: "50%" }}
            />
            <span>{userName}</span>
          </div>
        ))}
      </Flex>

      <Flex>
        {testCases?.map((testCase, i) => (
          <Box
            key={i}
            mr={4}
            color={testCase ? "green" : "red"}
            fontWeight="bold"
          >
            {testCase === true ? "✅ Test Case Passed" : "❌ Test Case Failed"}
          </Box>
        ))}
      </Flex>
      <br></br>
      <div style={{ display: "flex", gap: "30px" }}>
        <CodeMirror
          value={code}
          height="80vh"
          width="80vh"
          theme={okaidia}
          extensions={[javascript({ jsx: true })]}
          onChange={handleChange}
          style={{ fontSize: "16px" }}
        />
        <div>
          {codeDetails ? (
            <div>
              <h3 style={{ fontWeight: "bold" }}> {codeDetails.question} </h3>
              <div>{codeDetails.description}</div>
              <br />
              <div
                style={{
                  backgroundColor: "lightgray",
                  padding: "10px",
                  borderRadius: "2px",
                }}
              >
                <div>Inputs: {codeDetails.input}</div>
                <div>Sample Output: {codeDetails.output}</div>
              </div>
              <br />
              <Button
                onClick={getSolution}
                _hover={{ bg: "black", color: "white" }}
                bgColor="white" // Set background color to black
                color="black" // Set text color to white
                border="1px solid black"
              >
                Get Solution 👩‍💻
              </Button>
              <div>
                {show === true && credits === true ? (
                  <pre
                    style={{
                      backgroundColor: "black",
                      color: "white",
                      padding: "10px",
                      borderRadius: "2px",
                      marginTop: "10px",
                    }}
                  >
                    {codeDetails.solution}
                  </pre>
                ) : show ? (
                  <div style={{ padding: "10px", borderRadius: "2px" }}>
                    <p style={{ color: "red", fontWeight: "bold" }}>
                      Oops! Seems like you are out of credits 🥴
                    </p>
                    <Button
                      onClick={handlePayment}
                      size="sm"
                      _hover={{ bg: "green", color: "white" }}
                      colorScheme="red"
                    >
                      Buy Credits
                    </Button>
                  </div>
                ) : null}
              </div>

              <br />
              <Button
                onClick={getAIHelp}
                _hover={{ bg: "black", color: "white" }}
                bgColor="white"
                color="black"
                border="1px solid black"
              >
                Try Our AI ✨
              </Button>
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
      <br />
      <Button
        onClick={getOutput}
        _hover={{ bg: "black", color: "white" }}
        bgColor="black"
        color="white"
        isLoading={isLoading}
      >
        Evaluate Code
      </Button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Craft with AI ✨</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {loadingAI ? (
              <p>Loading AI response...</p>
            ) : aiResponse ? (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  padding: "10px",
                  borderRadius: "2px",
                }}
              >
                {aiResponse}
              </pre>
            ) : (
              <p>No AI response available.</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={() => setShowModal(false)}
              _hover={{ bg: "black", color: "white" }}
              bgColor="white"
              color="black"
              border="1px solid black"
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default CodeEditor;
