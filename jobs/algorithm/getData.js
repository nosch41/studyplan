const Stage = require("../../model/stage");
const ModalCourse = require("../../model/modalCourse");
const User = require("../../model/user");
const Semester = require("../../model/semester");
require("../../model/studyPlan");
require("../../model/courseSelection");

module.exports.getData = async () => {
  const data = {};

  let semesters = await Semester.find()
    .exec()
    .catch((err) => {
      console.log(err);
    });
  //only Semester Names remain
  semesters = semesters.map((sem) => sem.name);
  //I guess all Stages get fetched. to retrieve the current semester
  //
  const stage = await Stage.find()
    .populate("currentSemester")
    .exec()
    .catch((err) => {
      console.log(err);
    });
  /*
   */
  const users = await User.find()
    .populate({
      path: "courseSelection",
      populate: {
        path: "semesterPlans",
        populate: {
          path: "semester",
        },
      },
    })
    .populate({
      path: "studyPlan",
    })
    .populate({
      path: "startOfStudy",
    })
    .exec()
    .catch((err) => {
      console.log(err);
    });

  const modalCourse = await ModalCourse.find()
    .populate("semester")
    .exec()
    .catch((err) => {
      console.log(err);
    });

  // add current Semester - damn(leonard)
  //console.log(stage[0]);
  data.currentSemester = stage[0].currentSemester.name;

  data.users = [];
  users
    .filter((user) => user.courseSelection !== undefined && user.courseSelection !== null)
    .filter((user) => user.courseSelection.semesterPlans !== undefined && user.courseSelection.semesterPlans !== null)
    .filter((user) => user.courseSelection.semesterPlans.length !== 0)
    .forEach((user) => {
      const newUser = {};
      newUser.email = user.email;
      newUser.isPreferred = user.isPreferred;
      newUser.program = user.studyPlan.program.code;
      if(user.startOfStudy.name == "WiSe19/20" || user.startOfStudy.name == "SoSe20"){
      newUser.semester = 5
      }else{
      newUser.semester = 1
      }
      const semPlan = user.courseSelection.semesterPlans.find((plan) => {
        if (plan.semester == undefined) return false;
        return plan.semester.name == data.currentSemester;
      });
      if (semPlan == undefined) return;
      newUser.bookedCourses = semPlan.bookedCourses.map((course) => {
        return {
          code: course.code,
          priority: course.priority,
          isRepeater: course.isRepeater,
        };
      }).filter((course) => course.code != '');
      if(semPlan.maxCourses == undefined){
      newUser.maxCourses = 0;
      }else{
      newUser.maxCourses = semPlan.maxCourses;
      }
      data.users.push(newUser);
    });

  data.courses = {};
  modalCourse
    .filter((course) => course.semester.name == data.currentSemester)
    .forEach((course) => {
      const newCousre = {};
      newCousre.availablePlaces = course.availablePlaces;
      newCousre.program = course.program;
      newCousre.semesterInProgram = course.semesterInProgram;
      data.courses[course.code] = newCousre;
    });

	console.log(data.users)
  //only for showtime //TODO remove after showtime
  limitAvaiblePlaces(data);

  return data;
  /*
  data {
    users: [{
      email = user.email;
      isPreferred = true || false;
      program = "IMI-B";
      maxCourses = 100; //
      semester = 0-99999,
      bookedCourses: [{
          code: "VC1",
          priority: 1 - 6,
          isRepeater: true || false, //
      }],
    }], 
    courses: {
      VC1: {
        isRepeater = true;
        availablePlaces: 22-55,
        program: "IMI-B";
        semesterInProgram: [5,6];
      },
      VC2: {
        ...
      },
    },
     currentSemester: "SoSe22"
  };
  */
};

const limitAvaiblePlaces = (data) => {
  const courseWishes = data.users.reduce((x, y) => {
	  if(y.maxCourses == undefined){ return x}
	  else{ return x + y.maxCourses}
  }, 0);

  const origAvailablePlaces = Object.values(data.courses).reduce(
    (x, y) => x + y.availablePlaces,
    0
  );
  for (const key of Object.keys(data.courses)) {
    data.courses[key].availablePlaces = Math.ceil(
      data.courses[key].availablePlaces *
        Math.max(0.1, courseWishes / origAvailablePlaces)
    );
  }
};

const calcSemesterDiff = function (from, to, semesters) {
  //e.g. started at SoSe10(index: 0) and the selection is for WiSe10/11(index: 1) -> the user is than in the 2. semester
  if (!semesters.some((e) => e === to) || !semesters.some((e) => e === from))
    throw new Error("Semester not in Semester-List");
  return semesters.indexOf(to) - semesters.indexOf(from) + 1;
};
